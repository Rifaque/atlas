use app_lib::retrieval_quality::{
    bm25_rank, classify_relevance, reciprocal_rank_fusion, suppress_overlap, EvalCorpus,
    RankedCandidate, RelevanceLevel,
};
use serde::Serialize;
use std::collections::{HashMap, HashSet};

type RankedQuery = (String, Vec<String>, bool);

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct Metrics {
    recall_at_1: f32,
    recall_at_3: f32,
    recall_at_5: f32,
    precision_at_5: f32,
    mrr: f32,
    ndcg_at_5: f32,
    hit_at_5: f32,
    negative_rejection_rate: f32,
    duplicate_rate_at_5: f32,
    mean_distinct_files_at_5: f32,
    mean_context_chars_at_5: f32,
}

fn cosine_distance(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let norms =
        a.iter().map(|x| x * x).sum::<f32>().sqrt() * b.iter().map(|x| x * x).sum::<f32>().sqrt();
    1.0 - dot / norms.max(f32::EPSILON)
}

fn legacy_lexical_ids(query: &str, corpus: &EvalCorpus) -> Vec<String> {
    const STOP: &[&str] = &[
        "what", "where", "when", "why", "how", "who", "which", "this", "that", "these", "those",
        "from", "with", "about", "the", "and", "but", "for", "nor", "yet", "has", "have",
        "function", "class", "method", "variable", "code", "file", "does", "doing", "find",
        "search", "show", "tell", "explain",
    ];
    let keywords: Vec<_> = query
        .split(|character: char| character.is_ascii_punctuation() || character.is_whitespace())
        .filter(|token| token.len() > 3 && !STOP.contains(&token.to_lowercase().as_str()))
        .map(str::to_lowercase)
        .take(20)
        .collect();
    corpus
        .documents
        .iter()
        .filter(|document| {
            let text = document.text.to_lowercase();
            keywords.iter().any(|keyword| text.contains(keyword))
        })
        .map(|document| document.id.clone())
        .take(10)
        .collect()
}

fn evaluate(rankings: &[(String, Vec<String>, bool)], corpus: &EvalCorpus) -> Metrics {
    let mut result = Metrics::default();
    let positives = corpus
        .queries
        .iter()
        .filter(|query| !query.no_evidence)
        .count() as f32;
    let negatives = corpus
        .queries
        .iter()
        .filter(|query| query.no_evidence)
        .count() as f32;
    for (query_id, ranking, rejected) in rankings {
        let query = corpus
            .queries
            .iter()
            .find(|query| &query.id == query_id)
            .unwrap();
        if query.no_evidence {
            if *rejected {
                result.negative_rejection_rate += 1.0;
            }
            continue;
        }
        let relevant = query
            .relevance
            .values()
            .filter(|grade| **grade > 0)
            .count()
            .max(1);
        for (k, total) in [
            (1, &mut result.recall_at_1),
            (3, &mut result.recall_at_3),
            (5, &mut result.recall_at_5),
        ] {
            let hits = ranking
                .iter()
                .take(k)
                .filter(|id| query.relevance.get(*id).copied().unwrap_or(0) > 0)
                .count();
            *total += hits as f32 / relevant as f32;
        }
        let hits = ranking
            .iter()
            .take(5)
            .filter(|id| query.relevance.get(*id).copied().unwrap_or(0) > 0)
            .count();
        result.precision_at_5 += hits as f32 / 5.0;
        result.hit_at_5 += f32::from(hits > 0);
        let selected: Vec<_> = ranking.iter().take(5).collect();
        let unique_ids: HashSet<_> = selected.iter().copied().collect();
        result.duplicate_rate_at_5 += if selected.is_empty() {
            0.0
        } else {
            1.0 - unique_ids.len() as f32 / selected.len() as f32
        };
        let files: HashSet<_> = selected
            .iter()
            .filter_map(|id| corpus.documents.iter().find(|document| &document.id == *id))
            .map(|document| document.file_path.as_str())
            .collect();
        result.mean_distinct_files_at_5 += files.len() as f32;
        result.mean_context_chars_at_5 += selected
            .iter()
            .filter_map(|id| corpus.documents.iter().find(|document| &document.id == *id))
            .map(|document| document.text.chars().count())
            .sum::<usize>() as f32;
        if let Some(rank) = ranking
            .iter()
            .position(|id| query.relevance.get(id).copied().unwrap_or(0) > 0)
        {
            result.mrr += 1.0 / (rank + 1) as f32;
        }
        let dcg: f32 = ranking
            .iter()
            .take(5)
            .enumerate()
            .map(|(rank, id)| {
                (2_f32.powi(query.relevance.get(id).copied().unwrap_or(0) as i32) - 1.0)
                    / ((rank + 2) as f32).log2()
            })
            .sum();
        let mut grades: Vec<_> = query.relevance.values().copied().collect();
        grades.sort_by(|a, b| b.cmp(a));
        let ideal: f32 = grades
            .iter()
            .take(5)
            .enumerate()
            .map(|(rank, grade)| (2_f32.powi(*grade as i32) - 1.0) / ((rank + 2) as f32).log2())
            .sum();
        result.ndcg_at_5 += dcg / ideal.max(f32::EPSILON);
    }
    for value in [
        &mut result.recall_at_1,
        &mut result.recall_at_3,
        &mut result.recall_at_5,
        &mut result.precision_at_5,
        &mut result.mrr,
        &mut result.ndcg_at_5,
        &mut result.hit_at_5,
        &mut result.duplicate_rate_at_5,
        &mut result.mean_distinct_files_at_5,
        &mut result.mean_context_chars_at_5,
    ] {
        *value /= positives.max(1.0);
    }
    result.negative_rejection_rate /= negatives.max(1.0);
    result
}

#[tokio::test]
#[ignore = "requires local Ollama; run through pnpm retrieval:eval"]
async fn retrieval_evaluation() -> Result<(), Box<dyn std::error::Error>> {
    let corpus: EvalCorpus =
        serde_json::from_str(include_str!("../fixtures/retrieval/evaluation.json"))?;
    let host =
        std::env::var("ATLAS_EVAL_OLLAMA_HOST").unwrap_or_else(|_| "http://127.0.0.1:11434".into());
    let model = std::env::var("ATLAS_EVAL_EMBED_MODEL")
        .unwrap_or_else(|_| "nomic-embed-text:latest".into());
    let texts: Vec<_> = corpus
        .documents
        .iter()
        .map(|document| document.text.clone())
        .collect();
    let corpus_embedding_started = std::time::Instant::now();
    let doc_vectors =
        app_lib::retrieval_quality::embed_for_evaluation(&texts, &model, &host).await?;
    let corpus_embedding_ms = corpus_embedding_started.elapsed().as_secs_f64() * 1000.0;
    let mut modes: HashMap<&str, Vec<RankedQuery>> = HashMap::new();
    let mut query_embedding_ms = 0.0_f64;
    let mut semantic_ms = 0.0_f64;
    let mut lexical_ms = 0.0_f64;
    let mut fusion_ms = 0.0_f64;
    for query in &corpus.queries {
        let effective = query
            .context
            .as_ref()
            .map(|context| format!("{} {}", query.text, context))
            .unwrap_or_else(|| query.text.clone());
        let started = std::time::Instant::now();
        let query_vector = app_lib::retrieval_quality::embed_for_evaluation(
            std::slice::from_ref(&effective),
            &model,
            &host,
        )
        .await?
        .remove(0);
        query_embedding_ms += started.elapsed().as_secs_f64() * 1000.0;
        let started = std::time::Instant::now();
        let mut semantic: Vec<_> = corpus
            .documents
            .iter()
            .zip(&doc_vectors)
            .map(|(document, vector)| RankedCandidate {
                id: document.id.clone(),
                file_path: document.file_path.clone(),
                line_start: document.line_start,
                line_end: document.line_end,
                text: document.text.clone(),
                kind: document.kind.clone(),
                name: document.name.clone(),
                semantic_distance: Some(cosine_distance(&query_vector, vector)),
                lexical_score: 0.0,
                lexical_match_count: 0,
                exact_structural_match: false,
                fused_score: 0.0,
            })
            .collect();
        semantic.sort_by(|a, b| {
            a.semantic_distance
                .unwrap()
                .total_cmp(&b.semantic_distance.unwrap())
        });
        semantic_ms += started.elapsed().as_secs_f64() * 1000.0;
        let started = std::time::Instant::now();
        let lexical = bm25_rank(&effective, &corpus.documents, 40);
        lexical_ms += started.elapsed().as_secs_f64() * 1000.0;
        let baseline = legacy_lexical_ids(&effective, &corpus)
            .into_iter()
            .chain(semantic.iter().map(|item| item.id.clone()))
            .fold(Vec::<String>::new(), |mut ids, id| {
                if !ids.contains(&id) {
                    ids.push(id);
                }
                ids
            })
            .into_iter()
            .take(10)
            .collect();
        let started = std::time::Instant::now();
        let hybrid = suppress_overlap(reciprocal_rank_fusion(&semantic, &lexical, 40), 10);
        let rejected = classify_relevance(&hybrid) == RelevanceLevel::None;
        fusion_ms += started.elapsed().as_secs_f64() * 1000.0;
        eprintln!(
            "{} top={} distance={:.4} lexical={:.4} rejected={}",
            query.id,
            hybrid
                .first()
                .map(|item| item.id.as_str())
                .unwrap_or("none"),
            hybrid
                .first()
                .and_then(|item| item.semantic_distance)
                .unwrap_or(f32::INFINITY),
            hybrid
                .first()
                .map(|item| item.lexical_score)
                .unwrap_or_default(),
            rejected
        );
        modes
            .entry("baseline")
            .or_default()
            .push((query.id.clone(), baseline, false));
        modes.entry("semanticOnly").or_default().push((
            query.id.clone(),
            semantic
                .iter()
                .take(10)
                .map(|item| item.id.clone())
                .collect(),
            false,
        ));
        modes.entry("lexicalOnly").or_default().push((
            query.id.clone(),
            lexical
                .iter()
                .take(10)
                .map(|item| item.id.clone())
                .collect(),
            lexical.is_empty(),
        ));
        modes.entry("hybrid").or_default().push((
            query.id.clone(),
            hybrid.iter().map(|item| item.id.clone()).collect(),
            rejected,
        ));
    }
    let metrics: HashMap<_, _> = modes
        .iter()
        .map(|(name, rankings)| (*name, evaluate(rankings, &corpus)))
        .collect();
    let hybrid = metrics
        .get("hybrid")
        .ok_or("hybrid evaluation result is missing")?;
    let mut failures = Vec::new();
    if hybrid.hit_at_5 < 1.0 {
        failures.push(format!("Hit@5 {:.4} is below 1.0", hybrid.hit_at_5));
    }
    if hybrid.negative_rejection_rate < 1.0 {
        failures.push(format!(
            "negative rejection {:.4} is below 1.0",
            hybrid.negative_rejection_rate
        ));
    }
    if hybrid.ndcg_at_5 < 0.95 {
        failures.push(format!("nDCG@5 {:.4} is below 0.95", hybrid.ndcg_at_5));
    }
    if !failures.is_empty() {
        return Err(format!("retrieval quality gate failed: {}", failures.join("; ")).into());
    }
    let query_count = corpus.queries.len() as f64;
    let output = serde_json::json!({
        "corpus": { "documents": corpus.documents.len(), "queries": corpus.queries.len(), "embeddingModel": model },
        "metrics": metrics,
        "timingsMs": {
            "corpusEmbeddingTotal": corpus_embedding_ms,
            "queryEmbeddingMean": query_embedding_ms / query_count,
            "semanticRankingMean": semantic_ms / query_count,
            "lexicalRankingMean": lexical_ms / query_count,
            "fusionAndSelectionMean": fusion_ms / query_count
        }
    });
    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}

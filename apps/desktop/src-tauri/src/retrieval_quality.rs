use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

pub const RRF_K: f32 = 60.0;
pub const CANDIDATE_LIMIT: usize = 40;
pub const TOTAL_CONTEXT_BUDGET_CHARS: usize = 25_000;
pub const EVIDENCE_BUDGET_CHARS: usize = 9_000;
pub const PINNED_BUDGET_CHARS: usize = 6_000;
pub const HISTORY_BUDGET_CHARS: usize = 4_000;
pub const INSTRUCTION_BUDGET_CHARS: usize = 2_000;
pub const QUERY_BUDGET_CHARS: usize = 4_000;
pub const PER_EVIDENCE_CHARS: usize = 2_500;
pub const PER_PINNED_CHARS: usize = 2_000;
/// Automatic material remains secondary when the user has pinned a source.
pub const PINNED_AUTOMATIC_EVIDENCE_BUDGET_CHARS: usize = 3_000;
pub const PINNED_AUTOMATIC_EVIDENCE_LIMIT: usize = 2;

const _: () = assert!(
    EVIDENCE_BUDGET_CHARS
        + PINNED_BUDGET_CHARS
        + HISTORY_BUDGET_CHARS
        + INSTRUCTION_BUDGET_CHARS
        + QUERY_BUDGET_CHARS
        == TOTAL_CONTEXT_BUDGET_CHARS
);

pub fn truncate_chars(text: &str, max_chars: usize) -> String {
    text.chars().take(max_chars).collect()
}

pub fn contextualize_query(query: &str, previous_user_turn: Option<&str>) -> String {
    if tokenize(query).len() <= 4 {
        if let Some(previous) = previous_user_turn.filter(|turn| !turn.trim().is_empty()) {
            return format!("{} {}", truncate_chars(previous, 1_500), query);
        }
    }
    query.to_string()
}

pub async fn embed_for_evaluation(
    texts: &[String],
    model: &str,
    host: &str,
) -> Result<Vec<Vec<f32>>, String> {
    crate::embeddings::generate_embeddings(texts, model, host).await
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvalDocument {
    pub id: String,
    pub file_path: String,
    pub line_start: i64,
    pub line_end: i64,
    pub kind: Option<String>,
    pub name: Option<String>,
    pub text: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvalQuery {
    pub id: String,
    pub category: String,
    pub text: String,
    pub context: Option<String>,
    pub relevance: HashMap<String, u8>,
    pub no_evidence: bool,
}

#[derive(Debug, Deserialize)]
pub struct EvalCorpus {
    pub documents: Vec<EvalDocument>,
    pub queries: Vec<EvalQuery>,
}

#[derive(Debug, Clone)]
pub struct RankedCandidate {
    pub id: String,
    pub file_path: String,
    pub line_start: i64,
    pub line_end: i64,
    pub text: String,
    pub kind: Option<String>,
    pub name: Option<String>,
    pub semantic_distance: Option<f32>,
    pub lexical_score: f32,
    /// Distinct query terms that actually occur in this candidate's searchable
    /// text. A repeated generic identifier must not masquerade as broad support.
    pub lexical_match_count: usize,
    /// A whole source name or filename matched the raw query. This preserves
    /// direct symbol/file lookup even when it is necessarily a one-term query.
    pub exact_structural_match: bool,
    pub fused_score: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RelevanceLevel {
    Strong,
    Weak,
    None,
}

pub fn tokenize(input: &str) -> Vec<String> {
    const STOP_WORDS: &[&str] = &[
        "an", "and", "are", "as", "at", "be", "by", "does", "explain", "find", "for", "from",
        "how", "in", "is", "it", "of", "on", "or", "show", "that", "the", "this", "to", "what",
        "where", "which", "with",
    ];
    let mut expanded = String::with_capacity(input.len() * 2);
    let mut previous_lower_or_digit = false;
    for ch in input.chars() {
        if ch.is_uppercase() && previous_lower_or_digit {
            expanded.push(' ');
        }
        if ch.is_alphanumeric() {
            expanded.extend(ch.to_lowercase());
            previous_lower_or_digit = ch.is_lowercase() || ch.is_ascii_digit();
        } else {
            expanded.push(' ');
            previous_lower_or_digit = false;
        }
    }
    expanded
        .split_whitespace()
        .filter(|token| token.len() > 1 && !STOP_WORDS.contains(token))
        .map(str::to_string)
        .collect()
}

fn searchable_text(document: &EvalDocument) -> String {
    format!(
        "{} {} {} {}",
        document.file_path,
        document.name.as_deref().unwrap_or_default(),
        document.kind.as_deref().unwrap_or_default(),
        document.text
    )
}

pub fn bm25_rank(query: &str, documents: &[EvalDocument], limit: usize) -> Vec<RankedCandidate> {
    let query_tokens = tokenize(query);
    if query_tokens.is_empty() || documents.is_empty() {
        return Vec::new();
    }
    let tokenized: Vec<Vec<String>> = documents
        .iter()
        .map(|document| tokenize(&searchable_text(document)))
        .collect();
    let average_length =
        tokenized.iter().map(Vec::len).sum::<usize>() as f32 / tokenized.len() as f32;
    let mut document_frequency = HashMap::<&str, usize>::new();
    for tokens in &tokenized {
        for token in tokens.iter().map(String::as_str).collect::<HashSet<_>>() {
            *document_frequency.entry(token).or_default() += 1;
        }
    }
    let n = documents.len() as f32;
    let query_lower = query.to_lowercase();
    let mut ranked = Vec::new();
    for (document, tokens) in documents.iter().zip(&tokenized) {
        let mut frequencies = HashMap::<&str, usize>::new();
        for token in tokens {
            *frequencies.entry(token.as_str()).or_default() += 1;
        }
        let mut score = 0.0;
        let mut lexical_match_count = 0;
        for token in &query_tokens {
            let frequency = *frequencies.get(token.as_str()).unwrap_or(&0) as f32;
            if frequency == 0.0 {
                continue;
            }
            lexical_match_count += 1;
            let df = *document_frequency.get(token.as_str()).unwrap_or(&0) as f32;
            let idf = (1.0 + (n - df + 0.5) / (df + 0.5)).ln();
            let norm = 0.25 + 0.75 * tokens.len() as f32 / average_length.max(1.0);
            score += idf * frequency * 2.2 / (frequency + 1.2 * norm);
        }
        let path_lower = document.file_path.to_lowercase();
        let file_name = path_lower.rsplit(['/', '\\']).next().unwrap_or(&path_lower);
        let name_lower = document.name.as_deref().unwrap_or_default().to_lowercase();
        let exact_name_match = !name_lower.is_empty() && query_lower.contains(&name_lower);
        if exact_name_match {
            score += 4.0;
        }
        let exact_file_match = query_tokens
            .iter()
            .any(|token| file_name == token || file_name.starts_with(&format!("{token}.")));
        if exact_file_match {
            score += 2.5;
        }
        score += query_tokens
            .iter()
            .filter(|token| {
                path_lower
                    .split(['/', '\\'])
                    .any(|part| part == token.as_str())
            })
            .count() as f32
            * 0.35;
        if score > 0.0 {
            ranked.push(RankedCandidate {
                id: document.id.clone(),
                file_path: document.file_path.clone(),
                line_start: document.line_start,
                line_end: document.line_end,
                text: document.text.clone(),
                kind: document.kind.clone(),
                name: document.name.clone(),
                semantic_distance: None,
                lexical_score: score,
                lexical_match_count,
                exact_structural_match: exact_name_match || exact_file_match,
                fused_score: score,
            });
        }
    }
    ranked.sort_by(|a, b| {
        b.lexical_score
            .total_cmp(&a.lexical_score)
            .then_with(|| a.id.cmp(&b.id))
    });
    ranked.truncate(limit);
    ranked
}

pub fn reciprocal_rank_fusion(
    semantic: &[RankedCandidate],
    lexical: &[RankedCandidate],
    limit: usize,
) -> Vec<RankedCandidate> {
    let mut candidates = HashMap::<String, RankedCandidate>::new();
    for (rank, candidate) in semantic.iter().enumerate() {
        let mut item = candidate.clone();
        item.fused_score = 1.0 / (RRF_K + rank as f32 + 1.0);
        candidates.insert(item.id.clone(), item);
    }
    for (rank, lexical_candidate) in lexical.iter().enumerate() {
        let contribution = 1.0 / (RRF_K + rank as f32 + 1.0);
        candidates
            .entry(lexical_candidate.id.clone())
            .and_modify(|item| {
                item.lexical_score = lexical_candidate.lexical_score;
                item.lexical_match_count = lexical_candidate.lexical_match_count;
                item.exact_structural_match = lexical_candidate.exact_structural_match;
                item.fused_score += contribution;
            })
            .or_insert_with(|| {
                let mut item = lexical_candidate.clone();
                item.fused_score = contribution;
                item
            });
    }
    let mut ranked: Vec<_> = candidates.into_values().collect();
    ranked.sort_by(|a, b| {
        b.fused_score
            .total_cmp(&a.fused_score)
            .then_with(|| a.id.cmp(&b.id))
    });
    ranked.truncate(limit);
    ranked
}

pub fn classify_relevance(results: &[RankedCandidate]) -> RelevanceLevel {
    let Some(first) = results.first() else {
        return RelevanceLevel::None;
    };
    let similarity = first
        .semantic_distance
        .map(|distance| 1.0 / (1.0 + distance.max(0.0)))
        .unwrap_or(0.0);
    // Automatic generation is intentionally stricter than Find. A broad
    // embedding match or one repeated identifier (for example, `nodes`) is not
    // enough evidence that this workspace answers a general-knowledge question.
    // Strong grounding requires an exact source/file lookup or corroboration by
    // at least two distinct lexical terms plus a semantic match.
    if first.exact_structural_match && first.lexical_score >= 2.5
        || first.lexical_match_count >= 2 && first.lexical_score >= 1.0 && similarity >= 0.50
    {
        RelevanceLevel::Strong
    } else if first.lexical_match_count >= 2 && first.lexical_score >= 1.0 {
        RelevanceLevel::Weak
    } else {
        RelevanceLevel::None
    }
}

/// Retain a small set of direct source-discovery matches when the conservative
/// answerability classifier rejects a short query.  This deliberately requires
/// a normalized query token in the candidate path or an exact structural match;
/// semantic similarity or a text-only one-word match cannot activate it.
pub fn short_query_direct_matches(
    query: &str,
    results: &[RankedCandidate],
) -> Vec<RankedCandidate> {
    let tokens = tokenize(query);
    if tokens.is_empty() || tokens.len() > 2 || tokens.iter().any(|token| token.len() < 3) {
        return Vec::new();
    }
    results
        .iter()
        .filter(|candidate| {
            candidate.exact_structural_match
                || tokenize(&candidate.file_path)
                    .iter()
                    .any(|path_token| tokens.iter().any(|token| token == path_token))
        })
        .take(5)
        .cloned()
        .collect()
}

pub fn suppress_overlap(candidates: Vec<RankedCandidate>, limit: usize) -> Vec<RankedCandidate> {
    let mut selected: Vec<RankedCandidate> = Vec::new();
    let mut deferred = Vec::new();
    let mut seen = HashSet::new();
    for candidate in candidates {
        let fingerprint = candidate
            .text
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .to_lowercase();
        if !seen.insert(fingerprint) {
            continue;
        }
        let overlaps = selected.iter().any(|kept| {
            if kept.file_path != candidate.file_path {
                return false;
            }
            let start = kept.line_start.max(candidate.line_start);
            let end = kept.line_end.min(candidate.line_end);
            if end < start {
                return false;
            }
            let overlap = end - start + 1;
            let shorter = (kept.line_end - kept.line_start + 1)
                .min(candidate.line_end - candidate.line_start + 1)
                .max(1);
            overlap as f32 / shorter as f32 >= 0.6
        });
        if !overlaps {
            let same_file = selected
                .iter()
                .filter(|kept| kept.file_path == candidate.file_path)
                .count();
            if same_file >= 3 {
                deferred.push(candidate);
            } else {
                selected.push(candidate);
            }
            if selected.len() == limit {
                break;
            }
        }
    }
    for candidate in deferred {
        if selected.len() == limit {
            break;
        }
        selected.push(candidate);
    }
    selected
}

#[cfg(test)]
mod tests {
    use super::*;
    fn doc(id: &str, path: &str, name: &str, text: &str, start: i64, end: i64) -> EvalDocument {
        EvalDocument {
            id: id.into(),
            file_path: path.into(),
            line_start: start,
            line_end: end,
            kind: None,
            name: Some(name.into()),
            text: text.into(),
        }
    }
    #[test]
    fn tokenizer_handles_identifiers_and_unicode() {
        assert_eq!(
            tokenize("authorize_workspace EvidencePanel café::loader"),
            [
                "authorize",
                "workspace",
                "evidence",
                "panel",
                "café",
                "loader"
            ]
        );
    }
    #[test]
    fn exact_symbol_and_path_rank_first() {
        let docs = vec![
            doc(
                "right",
                "src/workspace.rs",
                "authorize_workspace",
                "fn authorize_workspace",
                1,
                4,
            ),
            doc(
                "wrong",
                "docs/workspace.md",
                "notes",
                "workspace overview",
                1,
                4,
            ),
        ];
        assert_eq!(bm25_rank("authorize_workspace", &docs, 2)[0].id, "right");
    }
    #[test]
    fn rrf_merges_duplicate_candidates() {
        let item = RankedCandidate {
            id: "same".into(),
            file_path: "a.rs".into(),
            line_start: 1,
            line_end: 4,
            text: "same".into(),
            kind: None,
            name: None,
            semantic_distance: Some(0.2),
            lexical_score: 0.0,
            lexical_match_count: 0,
            exact_structural_match: false,
            fused_score: 0.0,
        };
        let lexical = RankedCandidate {
            lexical_score: 2.0,
            lexical_match_count: 2,
            semantic_distance: None,
            ..item.clone()
        };
        let fused = reciprocal_rank_fusion(&[item], &[lexical], 5);
        assert_eq!(fused.len(), 1);
        assert!(fused[0].fused_score > 1.0 / 61.0);
    }
    #[test]
    fn overlap_and_duplicates_are_suppressed() {
        let make = |id: &str, start, end| RankedCandidate {
            id: id.into(),
            file_path: "a.rs".into(),
            line_start: start,
            line_end: end,
            text: "duplicate body".into(),
            kind: None,
            name: None,
            semantic_distance: None,
            lexical_score: 1.0,
            lexical_match_count: 1,
            exact_structural_match: false,
            fused_score: 1.0,
        };
        assert_eq!(
            suppress_overlap(vec![make("a", 1, 10), make("b", 3, 9)], 5).len(),
            1
        );
    }
    #[test]
    fn selection_prefers_other_files_before_a_fourth_chunk() {
        let make = |id: &str, path: &str, start| RankedCandidate {
            id: id.into(),
            file_path: path.into(),
            line_start: start,
            line_end: start + 2,
            text: format!("body {id}"),
            kind: None,
            name: None,
            semantic_distance: None,
            lexical_score: 1.0,
            lexical_match_count: 1,
            exact_structural_match: false,
            fused_score: 1.0,
        };
        let selected = suppress_overlap(
            vec![
                make("a1", "a.rs", 1),
                make("a2", "a.rs", 10),
                make("a3", "a.rs", 20),
                make("a4", "a.rs", 30),
                make("b1", "b.rs", 1),
            ],
            5,
        );
        assert_eq!(selected[3].id, "b1");
        assert_eq!(selected[4].id, "a4");
    }
    #[test]
    fn unrelated_candidate_is_rejected() {
        let weak = RankedCandidate {
            id: "x".into(),
            file_path: "x".into(),
            line_start: 1,
            line_end: 1,
            text: "x".into(),
            kind: None,
            name: None,
            semantic_distance: Some(1.2),
            lexical_score: 0.0,
            lexical_match_count: 0,
            exact_structural_match: false,
            fused_score: 0.0,
        };
        assert_eq!(
            classify_relevance(std::slice::from_ref(&weak)),
            RelevanceLevel::None
        );
        let lexical_noise = RankedCandidate {
            semantic_distance: Some(0.98),
            lexical_score: 3.5,
            lexical_match_count: 1,
            ..weak
        };
        assert_eq!(classify_relevance(&[lexical_noise]), RelevanceLevel::None);
    }

    #[test]
    fn generic_single_term_noise_cannot_become_strong_grounding() {
        let generic_nodes = RankedCandidate {
            id: "tree".into(),
            file_path: "src/FileTree.tsx".into(),
            line_start: 1,
            line_end: 4,
            text: "nodes nodes nodes".into(),
            kind: None,
            name: Some("FileTree".into()),
            semantic_distance: Some(1.02),
            lexical_score: 9.0,
            lexical_match_count: 1,
            exact_structural_match: false,
            fused_score: 0.02,
        };
        assert_eq!(classify_relevance(&[generic_nodes]), RelevanceLevel::None);

        let corroborated = RankedCandidate {
            lexical_match_count: 3,
            semantic_distance: Some(0.35),
            lexical_score: 3.0,
            ..RankedCandidate {
                id: "auth".into(),
                file_path: "src/workspace.rs".into(),
                line_start: 1,
                line_end: 4,
                text: "workspace authorization rejects path traversal".into(),
                kind: None,
                name: Some("authorized_file".into()),
                semantic_distance: None,
                lexical_score: 0.0,
                lexical_match_count: 0,
                exact_structural_match: false,
                fused_score: 0.0,
            }
        };
        assert_eq!(classify_relevance(&[corroborated]), RelevanceLevel::Strong);
    }

    #[test]
    fn short_direct_workspace_terms_have_bounded_weak_fallback() {
        let candidates = vec![RankedCandidate {
            id: "portfolio".into(),
            file_path: r"\\?\C:\Projects\rifaque-portfolio\src\App.tsx".into(),
            line_start: 1,
            line_end: 4,
            text: "export default App".into(),
            kind: None,
            name: None,
            semantic_distance: Some(0.8),
            lexical_score: 0.01,
            lexical_match_count: 1,
            exact_structural_match: false,
            fused_score: 0.02,
        }];
        assert_eq!(classify_relevance(&candidates), RelevanceLevel::None);
        assert_eq!(
            short_query_direct_matches("portfolio", &candidates).len(),
            1
        );
        assert!(short_query_direct_matches("kubernetes", &candidates).is_empty());
    }

    #[test]
    fn lexical_negative_query_returns_no_candidates() {
        let docs = vec![doc(
            "workspace",
            "src/workspace.rs",
            "authorize_workspace",
            "canonical workspace authorization",
            1,
            4,
        )];
        assert!(bm25_rank("Explain Kubernetes pod scheduling", &docs, 5).is_empty());
    }

    #[test]
    fn context_budget_is_global_deterministic_and_unicode_safe() {
        assert_eq!(
            EVIDENCE_BUDGET_CHARS
                + PINNED_BUDGET_CHARS
                + HISTORY_BUDGET_CHARS
                + INSTRUCTION_BUDGET_CHARS
                + QUERY_BUDGET_CHARS,
            TOTAL_CONTEXT_BUDGET_CHARS
        );
        assert_eq!(truncate_chars("évidence", 2), "év");
        assert_eq!(
            contextualize_query("How is it enforced?", Some("workspace authorization")),
            "workspace authorization How is it enforced?"
        );
    }
}

use std::path::Path;
use tree_sitter::Parser;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SemanticChunk {
    pub text: String,
    pub start_line: usize,
    pub end_line: usize,
    pub kind: String,
    pub name: Option<String>,
}

pub struct CodeParser {
    parser: Parser,
}

impl CodeParser {
    pub fn new() -> Self {
        Self {
            parser: Parser::new(),
        }
    }

    pub async fn parse_semantic_chunks(
        &mut self,
        file_path: &str,
        content: &str,
    ) -> Vec<SemanticChunk> {
        let extension = Path::new(file_path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        if matches!(extension, "md" | "mdx") {
            return Self::parse_markdown_sections(content);
        }

        let language = match extension {
            "ts" => Some(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()),
            "tsx" => Some(tree_sitter_typescript::LANGUAGE_TSX.into()),
            "js" | "jsx" => Some(tree_sitter_javascript::LANGUAGE.into()),
            "rs" => Some(tree_sitter_rust::LANGUAGE.into()),
            "py" => Some(tree_sitter_python::LANGUAGE.into()),
            _ => None,
        };

        if let Some(lang) = language {
            let _ = self.parser.set_language(&lang);
            let tree = self.parser.parse(content, None).unwrap();
            let root_node = tree.root_node();

            let mut chunks = Vec::new();
            self.walk_node(root_node, content, &mut chunks);

            if !chunks.is_empty() {
                return chunks;
            }
        }

        Vec::new()
    }

    fn parse_markdown_sections(content: &str) -> Vec<SemanticChunk> {
        let lines: Vec<_> = content.lines().collect();
        if lines.is_empty() {
            return Vec::new();
        }
        let mut starts: Vec<usize> = lines
            .iter()
            .enumerate()
            .filter_map(|(index, line)| line.trim_start().starts_with('#').then_some(index))
            .collect();
        if starts.first().copied() != Some(0) {
            starts.insert(0, 0);
        }
        starts
            .iter()
            .enumerate()
            .flat_map(|(index, start)| {
                let end = starts.get(index + 1).copied().unwrap_or(lines.len());
                let name = lines[*start]
                    .trim_start()
                    .trim_start_matches('#')
                    .trim()
                    .to_string();
                let mut chunks = Vec::new();
                let mut cursor = *start;
                while cursor < end {
                    let chunk_end = (cursor + 80).min(end);
                    let text = lines[cursor..chunk_end].join("\n");
                    if !text.trim().is_empty() {
                        chunks.push(SemanticChunk {
                            text,
                            start_line: cursor + 1,
                            end_line: chunk_end,
                            kind: "section".to_string(),
                            name: (!name.is_empty()).then_some(name.clone()),
                        });
                    }
                    if chunk_end == end {
                        break;
                    }
                    cursor = chunk_end.saturating_sub(10);
                }
                chunks
            })
            .collect()
    }

    fn walk_node<'a>(
        &self,
        node: tree_sitter::Node<'a>,
        content: &str,
        chunks: &mut Vec<SemanticChunk>,
    ) {
        let kind = node.kind();

        let should_chunk = match kind {
            // Rust
            "function_item" | "struct_item" | "enum_item" | "impl_item" | "trait_item"
            | "mod_item" => true,
            // TypeScript / JavaScript
            "class_declaration"
            | "function_declaration"
            | "method_definition"
            | "interface_declaration"
            | "type_alias_declaration" => true,
            // Python
            "function_definition" | "class_definition" => true,
            _ => false,
        };

        if should_chunk {
            // Public source locations are 1-based and inclusive.
            let start_line = node.start_position().row + 1;
            let end_line = node.end_position().row + 1;

            if end_line.saturating_sub(start_line) >= 3 {
                let range = node.byte_range();
                let text = content[range].to_string();
                let name = self.find_name(node, content);

                chunks.push(SemanticChunk {
                    text,
                    start_line,
                    end_line,
                    kind: kind.to_string(),
                    name,
                });
            }
        }

        // Recursively walk children
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            self.walk_node(child, content, chunks);
        }
    }

    fn find_name<'a>(&self, node: tree_sitter::Node<'a>, content: &str) -> Option<String> {
        // Look for common name patterns
        for i in 0..node.child_count() {
            let child = node.child(i).unwrap();
            if child.kind() == "identifier"
                || child.kind() == "type_identifier"
                || child.kind() == "name"
            {
                return Some(content[child.byte_range()].to_string());
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn public_source_ranges_are_one_based() {
        let source = "fn example() {\n    let first = 1;\n    let second = 2;\n    println!(\"{}\", first + second);\n}\n";
        let mut parser = CodeParser::new();
        let chunks = parser.parse_semantic_chunks("example.rs", source).await;
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].start_line, 1);
        assert_eq!(chunks[0].end_line, 5);
    }

    #[tokio::test]
    async fn tsx_uses_tsx_grammar_and_keeps_component_name() {
        let source = "export function EvidencePanel() {\n  return (\n    <aside aria-label=\"Evidence\">Sources</aside>\n  );\n}\n";
        let mut parser = CodeParser::new();
        let chunks = parser
            .parse_semantic_chunks("EvidencePanel.tsx", source)
            .await;
        assert_eq!(chunks[0].name.as_deref(), Some("EvidencePanel"));
        assert!(chunks[0].text.contains("<aside"));
    }

    #[tokio::test]
    async fn markdown_chunks_follow_heading_sections() {
        let source = "# Intro\nOverview.\n\n## Supported formats\nRust and TypeScript.\n\n## Unrelated\nOther text.";
        let mut parser = CodeParser::new();
        let chunks = parser.parse_semantic_chunks("formats.md", source).await;
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[1].name.as_deref(), Some("Supported formats"));
        assert_eq!((chunks[1].start_line, chunks[1].end_line), (4, 6));
    }
}

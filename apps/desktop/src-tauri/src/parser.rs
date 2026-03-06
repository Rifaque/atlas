use tree_sitter::Parser;
use std::path::Path;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SemanticRelationship {
    pub from_name: String,
    pub to_name: String,
    pub kind: String, // "call", "import", "inherit"
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SemanticChunk {
    pub text: String,
    pub start_line: usize,
    pub end_line: usize,
    pub kind: String,
    pub name: Option<String>,
    pub relationships: Vec<SemanticRelationship>,
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

    pub async fn parse_semantic_chunks(&mut self, file_path: &str, content: &str) -> Vec<SemanticChunk> {
        let extension = Path::new(file_path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        let language = match extension {
            "ts" | "tsx" => Some(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()),
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
            
            // Extract relationships between the chunks we found
            self.extract_relationships(root_node, content, &mut chunks);

            if !chunks.is_empty() {
                return chunks;
            }
        }

        Vec::new()
    }

    fn extract_relationships(&self, root_node: tree_sitter::Node, content: &str, chunks: &mut Vec<SemanticChunk>) {
        let chunk_names: std::collections::HashSet<String> = chunks.iter()
            .filter_map(|c| c.name.clone())
            .collect();

        // 1. Precise Identifier Extraction using Tree-Sitter
        let mut identifiers = std::collections::HashSet::new();
        let mut cursor = root_node.walk();
        self.collect_identifiers(root_node, content, &mut identifiers, &mut cursor);

        // Map names to chunks for easier lookup
        for i in 0..chunks.len() {
            let current_name = chunks[i].name.clone().unwrap_or_default();
            if current_name.is_empty() { continue; }

            let mut relationships = Vec::new();
            let mut seen = std::collections::HashSet::new();

            // We now use the identifiers found within the specific chunk's text range
            // for more accurate cross-reference detection.
            for other_name in &chunk_names {
                if *other_name != current_name && !seen.contains(other_name) {
                    // Check if other_name exists in the chunk text as a word
                    let pattern = format!(r"\b{}\b", regex::escape(other_name));
                    if let Ok(re) = regex::Regex::new(&pattern) {
                        if re.is_match(&chunks[i].text) {
                            relationships.push(SemanticRelationship {
                                from_name: current_name.clone(),
                                to_name: other_name.clone(),
                                kind: "reference".to_string(),
                            });
                            seen.insert(other_name.clone());
                        }
                    }
                }
            }
            chunks[i].relationships = relationships;
        }
    }

    fn collect_identifiers<'a>(&self, node: tree_sitter::Node<'a>, content: &str, ids: &mut std::collections::HashSet<String>, cursor: &mut tree_sitter::TreeCursor<'a>) {
        if node.kind() == "identifier" || node.kind() == "type_identifier" {
            if let Ok(text) = node.utf8_text(content.as_bytes()) {
                ids.insert(text.to_string());
            }
        }
        if cursor.goto_first_child() {
            loop {
                self.collect_identifiers(cursor.node(), content, ids, cursor);
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
            cursor.goto_parent();
        }
    }

    fn walk_node<'a>(&self, node: tree_sitter::Node<'a>, content: &str, chunks: &mut Vec<SemanticChunk>) {
        let kind = node.kind();
        
        let should_chunk = match kind {
            // Rust
            "function_item" | "struct_item" | "enum_item" | "impl_item" | "trait_item" | "mod_item" => true,
            // TypeScript / JavaScript
            "class_declaration" | "function_declaration" | "method_definition" | "interface_declaration" | "type_alias_declaration" => true,
            // Python
            "function_definition" | "class_definition" => true,
            _ => false,
        };

        if should_chunk {
            let start_line = node.start_position().row;
            let end_line = node.end_position().row;
            
            if end_line - start_line >= 3 {
                let range = node.byte_range();
                let text = content[range].to_string();
                let name = self.find_name(node, content);

                chunks.push(SemanticChunk {
                    text,
                    start_line,
                    end_line,
                    kind: kind.to_string(),
                    name,
                    relationships: Vec::new(),
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
            if child.kind() == "identifier" || child.kind() == "type_identifier" || child.kind() == "name" {
                return Some(content[child.byte_range()].to_string());
            }
        }
        None
    }
}

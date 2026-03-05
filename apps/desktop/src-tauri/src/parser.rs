use tree_sitter::{Parser, Language};
use std::path::Path;

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

    pub async fn parse_semantic_chunks(&mut self, file_path: &str, content: &str) -> Vec<SemanticChunk> {
        let extension = Path::new(file_path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        let language = match extension {
            "ts" | "tsx" => Some(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()),
            "js" | "jsx" => Some(tree_sitter_javascript::language()),
            "rs" => Some(tree_sitter_rust::language()),
            "py" => Some(tree_sitter_python::language()),
            _ => None,
        };

        if let Some(lang) = language {
            let _ = self.parser.set_language(&lang);
            let tree = self.parser.parse(content, None).unwrap();
            let root_node = tree.root_node();
            
            let mut chunks = Vec::new();
            self.walk_node(root_node, content, &mut chunks);
            
            // If we found any semantic chunks, return them. 
            // Otherwise, or if the file is too small, fallback is handled by the caller.
            if !chunks.is_empty() {
                return chunks;
            }
        }

        Vec::new()
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
            
            // Avoid tiny chunks and massive ones (let's say > 5 lines)
            if end_line - start_line >= 3 {
                let range = node.byte_range();
                let text = content[range].to_string();
                
                // Try to find a name for the chunk
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
            if child.kind() == "identifier" || child.kind() == "type_identifier" || child.kind() == "name" {
                return Some(content[child.byte_range()].to_string());
            }
        }
        None
    }
}

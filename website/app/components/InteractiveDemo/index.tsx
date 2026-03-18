"use client";

// Compatibility shim for stale dev/build manifests that may still reference
// the previous InteractiveDemo module after the section was removed.
export function InteractiveDemo() {
  return null;
}

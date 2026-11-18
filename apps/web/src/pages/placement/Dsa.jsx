import React from 'react';
import Technical from './Technical';

// DSA multiple-choice practice reuses the technical practice screen with the DSA module.
export default function Dsa() {
  return (
    <Technical
      moduleType="DSA"
      badge="DSA PRACTICE"
      heading="Data Structures & Algorithms Practice"
      blurb="Multiple-choice questions on arrays, trees, graphs, dynamic programming and more. For hands-on problems, use Coding Practice."
      fallbackLabel="Data Structures & Algorithms"
    />
  );
}

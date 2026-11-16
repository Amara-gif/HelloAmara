// Shape the patch for task-detail forms, including the due/end mirror shared by
// the Details side form and the Plan card.
export function taskFormPatch(formName, fields, values) {
  const patch = {};
  for (const field of fields) patch[field] = values[field] ?? '';
  // Due is the task-list date; End is the plan date. Keep both mirrors in step.
  if (formName === 'task-fields') patch.end = patch.due || '';
  if (formName === 'task-plan') {
    patch.due = patch.end || '';
    // Older rows may carry the camelCase dependency field; keep both in step.
    if (patch.depends_on !== undefined) patch.dependsOn = patch.depends_on;
  }
  return patch;
}

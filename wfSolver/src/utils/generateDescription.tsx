import type { ArgoTemplate } from '../types';
import { capitalizeTaskName } from './capitalizeTaskName';

function generateDescription(
  taskName: string,
  templateName: string,
  template?: ArgoTemplate,
  workflowMeta?: { annotations?: Record<string, string>; labels?: Record<string, string> }
): string {
  if (template?.metadata?.annotations) {
    const annotations = template.metadata.annotations;
    const descriptionKeys = [
      'description',
      'workflows.argoproj.io/description',
      'summary',
      'documentation',
      'doc',
      'info',
    ];

    for (const key of descriptionKeys) {
      if (annotations[key]) {
        return annotations[key];
      }
    }
  }

  if (template?.metadata?.labels) {
    const labels = template.metadata.labels;
    if (labels.description || labels.summary) {
      return labels.description || labels.summary;
    }
  }

  if (workflowMeta?.annotations) {
    const taskSpecificKey = `${taskName}.description`;
    const templateSpecificKey = `${templateName}.description`;

    if (workflowMeta.annotations[taskSpecificKey]) {
      return workflowMeta.annotations[taskSpecificKey];
    }
    if (workflowMeta.annotations[templateSpecificKey]) {
      return workflowMeta.annotations[templateSpecificKey];
    }
  }

  if (template?.container?.args) {
    const echoArg = template.container.args.find(
      arg => arg.includes('echo') && arg.includes('Executing')
    );
    if (echoArg) {
      const match = echoArg.match(/echo\s+['"]([^'"]+)['"]/);
      if (match) {
        return match[1];
      }
    }
  }

  const cleanTemplateName = templateName
    .replace(/-template$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  if (cleanTemplateName !== capitalizeTaskName(taskName)) {
    return `Execute ${cleanTemplateName}`;
  }

  return `Execute ${capitalizeTaskName(taskName)} task`;
}

export default generateDescription;

// src/utils/templateManager.ts
import { getAdminSetting } from '../db';
import { UserPptxTemplate } from '../components/settings/UserPreferences'; // Importer le type
// Utilisation d'un chemin relatif car l'alias @ n'est pas configuré dans vite.config.ts
// import defaultTemplateUrlPathOld from '../assets/templates/default.pptx?url'; // Ancienne méthode
const defaultTemplateUrlPath = new URL('../assets/templates/default.pptx', import.meta.url).href;

export const TOOL_DEFAULT_TEMPLATE_ID = 'tool_default_template'; // ID constant pour le modèle de l'outil

/**
 * Récupère le fichier de modèle PowerPoint à utiliser pour la génération.
 * Priorise le modèle sélectionné par l'utilisateur (s'il est fourni),
 * puis le modèle par défaut de l'utilisateur (configuré dans les préférences),
 * puis le modèle par défaut de l'outil comme fallback ultime.
 *
 * @param selectedTemplateId L'ID du modèle explicitement sélectionné par l'utilisateur pour cette génération spécifique (optionnel).
 *                         Peut être l'ID d'un UserPptxTemplate ou TOOL_DEFAULT_TEMPLATE_ID.
 *                         Si undefined, la fonction tentera de charger le modèle par défaut de l'utilisateur, puis celui de l'outil.
 * @returns Promise<File> Le fichier de modèle à utiliser.
 * @throws Error si aucun modèle ne peut être chargé (par exemple, si le fetch du modèle par défaut de l'outil échoue).
 */
export async function getActivePptxTemplateFile(selectedTemplateId?: string): Promise<File> {
  let templateToUse: UserPptxTemplate | null = null;
  let isToolDefault = false;

  if (selectedTemplateId === TOOL_DEFAULT_TEMPLATE_ID) {
    isToolDefault = true;
  } else if (selectedTemplateId) {
    // Un modèle spécifique (personnalisé) a été demandé pour cette génération
    const userTemplates: UserPptxTemplate[] = await getAdminSetting('userPptxTemplates') || [];
    templateToUse = userTemplates.find(t => t.id === selectedTemplateId) || null;
    if (!templateToUse) {
      console.warn(`[templateManager] Modèle sélectionné avec ID "${selectedTemplateId}" non trouvé. Tentative avec le modèle par défaut utilisateur.`);
      // Fallback vers le défaut utilisateur si l'ID sélectionné n'est pas trouvé (ne devrait pas arriver si l'UI est correcte et synchro)
      // Laisser la logique ci-dessous gérer le fallback vers le défaut utilisateur puis le défaut outil.
    }
  }

  // Si aucun modèle spécifique n'a été sélectionné pour cette génération OU si le modèle sélectionné n'a pas été trouvé
  if (!isToolDefault && !templateToUse) {
    const userDefaultId: string | null = await getAdminSetting('userDefaultPptxTemplateId');
    if (userDefaultId) {
      const userTemplates: UserPptxTemplate[] = await getAdminSetting('userPptxTemplates') || [];
      templateToUse = userTemplates.find(t => t.id === userDefaultId) || null;
      if (!templateToUse) {
        console.warn(`[templateManager] Modèle par défaut utilisateur (ID: "${userDefaultId}") non trouvé dans la liste des modèles. Utilisation du modèle par défaut de l'outil.`);
        isToolDefault = true; // Fallback au modèle de l'outil
      }
    } else {
      // Aucun modèle par défaut utilisateur configuré, on utilise celui de l'outil
      isToolDefault = true;
    }
  }

  if (isToolDefault || !templateToUse) {
    // Utiliser le modèle par défaut de l'outil
    console.log("[templateManager] Utilisation du modèle PowerPoint par défaut de l'outil.");
    try {
      const response = await fetch(defaultTemplateUrlPath);
      if (!response.ok) {
        throw new Error(`HTTP error when fetching tool default template! status: ${response.status} - ${response.statusText}`);
      }
      const blob = await response.blob();

      // Nom du fichier dans le log correspondra au nom source
      console.log(`[templateManager] Default tool template ('default.pptx') blob details: Size: ${blob.size} bytes, Type: ${blob.type}`);

      const mimeType = blob.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      // Vérifier si le type MIME est suspect
      if (mimeType !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation' && !mimeType.startsWith('application/vnd.ms-powerpoint') && mimeType !== 'application/zip' && mimeType !== 'application/octet-stream') {
          console.warn(`[templateManager] Suspicious MIME type for default template: ${mimeType}. Expected a PowerPoint type or application/zip.`);
      }

      // Utiliser le nom original pour l'objet File
      return new File([blob], "default.pptx", { type: mimeType });
    } catch (error) {
      console.error("[templateManager] Failed to fetch or process the tool's default PPTX template:", error);
      throw new Error("Impossible de charger le modèle PowerPoint par défaut de l'outil. Vérifiez la console pour plus de détails.");
    }
  } else {
    // Utiliser le modèle personnalisé (templateToUse est non null ici)
    console.log(`[templateManager] Utilisation du modèle PowerPoint personnalisé: "${templateToUse.name}" (ID: ${templateToUse.id})`);
    return new File([templateToUse.fileBlob], templateToUse.name, { type: templateToUse.fileBlob.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  }
}

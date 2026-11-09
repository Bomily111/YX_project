import { registerRockModule } from '@/modules/rock/resources'
import { registerSupportModule } from '@/modules/support/resources'
import { registerBlastModule } from '@/modules/blast/resources'
import { registerVentilationModule } from '@/modules/ventilation/resources'
import { resourceRegistry } from '@/platform/resources/ResourceRegistry'
import { resourceManager } from '@/platform/resources/ResourceManager'
import { AGENT_SCENE_RESOURCES } from '@/platform/tasks/samples/SceneExplorationWorkflow'
import type { SceneCapabilityReport } from './SceneCapabilities'
/** Metadata registration only: never load a model or create/replace a task. */
export function inspectPlatformSceneCapabilities(): SceneCapabilityReport {
  registerRockModule(); registerSupportModule(); registerBlastModule(); registerVentilationModule()
  return { scope: 'registered-platform-capabilities', targetDataVerified: false,
    resources: AGENT_SCENE_RESOURCES.flatMap(id => {
      const resource = resourceRegistry.get(id)
      return resource ? [{ id, module: resource.module, type: resource.type,
        declaredRange: resource.chainageRange ? { ...resource.chainageRange } : undefined,
        state: resourceManager.getState(id).status }] : []
    }) }
}

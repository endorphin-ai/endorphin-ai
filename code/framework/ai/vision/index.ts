/**
 * Vision Verification Module
 * Exports the VisionVerifier and provides a singleton accessor
 */

export { VisionVerifier } from './vision-verifier.js';
export type { VisionVerificationResult } from './vision-verifier.js';

import { VisionVerifier } from './vision-verifier.js';
import type { VisionConfig } from '../../types/agent.js';

let visionVerifierInstance: VisionVerifier | null = null;

/**
 * Get or create the VisionVerifier instance
 * Returns null if vision is not configured or disabled
 */
export async function getVisionVerifier(config?: VisionConfig): Promise<VisionVerifier | null> {
  if (!config?.enabled) {
    return null;
  }

  if (!visionVerifierInstance || !visionVerifierInstance.isEnabled()) {
    visionVerifierInstance = new VisionVerifier(config);
    await visionVerifierInstance.init();
  }

  return visionVerifierInstance;
}

/**
 * Reset the vision verifier instance (useful for testing)
 */
export function resetVisionVerifier(): void {
  visionVerifierInstance = null;
}

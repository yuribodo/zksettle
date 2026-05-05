import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir, type CompiledCircuit, type InputMap } from "@noir-lang/noir_js";

export interface ProverHandles {
  noir: Noir;
  backend: UltraHonkBackend;
  api: Barretenberg;
}

/**
 * Singleton-style prover that lazily initialises the Barretenberg WASM backend
 * on first use and coalesces concurrent init calls onto a single promise.
 *
 * Works in both browser and Node.js environments.
 */
export class Prover {
  private handles: ProverHandles | null = null;
  private initPromise: Promise<ProverHandles> | null = null;
  private readonly circuit: CompiledCircuit;
  private readonly threads: number;

  constructor(circuit: CompiledCircuit, threads?: number) {
    this.circuit = circuit;
    this.threads = threads ?? 0; // 0 signals "detect at init time"
  }

  /**
   * Initialise the prover (Barretenberg WASM + Noir instance).
   * Safe to call multiple times — concurrent callers share one init promise.
   */
  async init(): Promise<ProverHandles> {
    if (this.handles) {
      return this.handles;
    }

    // Coalesce concurrent init calls to avoid spawning duplicate worker pools.
    this.initPromise ??= this.doInit();

    return this.initPromise;
  }

  private async doInit(): Promise<ProverHandles> {
    try {
      const threads = this.threads || (await this.detectThreads());
      const api = await Barretenberg.new({ threads });
      const noir = new Noir(this.circuit);
      const backend = new UltraHonkBackend(this.circuit.bytecode, api);
      const handles: ProverHandles = { noir, backend, api };
      this.handles = handles;
      return handles;
    } catch (err) {
      // Reset so a later retry can attempt init again.
      this.initPromise = null;
      throw err;
    }
  }

  /**
   * Detect available parallelism. Uses `navigator.hardwareConcurrency` in
   * browsers and `os.availableParallelism()` / `os.cpus().length` in Node.
   * Caps at 8 threads to avoid over-subscription.
   */
  private async detectThreads(): Promise<number> {
    // Browser
    if (
      typeof navigator !== "undefined" &&
      navigator.hardwareConcurrency
    ) {
      return Math.min(navigator.hardwareConcurrency, 8);
    }

    // Node.js
    try {
      const os = await import("node:os");
      const count =
        typeof os.availableParallelism === "function"
          ? os.availableParallelism()
          : os.cpus().length;
      return Math.min(count, 8);
    } catch {
      return 4; // fallback
    }
  }

  /**
   * Generate an UltraHonk proof for the given inputs.
   * Initialises the prover on first call if not already done.
   */
  async generateProof(
    inputs: InputMap,
  ): Promise<{ proof: Uint8Array; publicInputs: string[] }> {
    const { noir, backend } = await this.init();
    const { witness } = await noir.execute(inputs);
    const { proof, publicInputs } = await backend.generateProof(witness);
    return { proof, publicInputs };
  }

  /**
   * Destroy the Barretenberg instance and release WASM memory.
   */
  async destroy(): Promise<void> {
    if (this.handles) {
      await this.handles.api.destroy();
      this.handles = null;
      this.initPromise = null;
    }
  }
}

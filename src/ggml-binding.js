// src/ggml-binding.js
// In-process ggml/llama.cpp bindings for direct model loading
//
// NOTE: This module provides the interface for in-process ggml/llama.cpp integration.
// A native Node.js addon (using node-gyp) would be needed to wrap the ggml C library.
// Until a native toolchain is available, this serves as the abstraction layer.
//
// Supported operations:
// - Load a GGUF model file directly in-process
// - Generate text completion given prompt and parameters
// - Access model metadata (context size, dimensions, etc.)
// - Free/model cleanup

'use strict';

const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/** GGML model type */
const ModelType = {
  UNKNOWN: 'unknown',
  LLAMA_CPP: 'llama.cpp',
  EXLLAVA3: 'exllama.v3',
};

/** Sampling parameters */
const SamplingParams = {
  /** Maximum number of tokens to generate */
  maxTokens: 256,
  /** Temperature for sampling (0.0 = deterministic) */
  temperature: 0.7,
  /** Top-p nucleus sampling */
  topP: 0.95,
  /** Number of context tokens to consider */
  contextSize: 512,
  /** Whether to use penalties */
  repeatPenalty: 1.0,
  /** Penalty for repeat tokens */
  repeatLastN: 64,
};

/*--------------------------------------------------------------------------
// GGMLBinding — in-process model interface
--------------------------------------------------------------------------*/

class GGMLBinding {
  /**
   * Create a new GGML binding instance.
   * @param {Object} opts Options
   * @param {string} opts.modelPath Path to .gguf model file
   * @param {number} [opts.nCtx=512] Context size
   * @param {number} [opts.nGpuLayers=-1] GPU layers (-1 = auto, use CPU only)
   */
  constructor(opts) {
    this.modelPath = opts.modelPath;
    this.nCtx = opts.nCtx ?? 512;
    this.nGpuLayers = opts.nGpuLayers ?? -1;
    this.modelType = this._detectModelType();
    this.isLoaded = false;
    this.context = null;
    this.embeddings = [];

    if (!fs.existsSync(this.modelPath)) {
      throw new Error(`Model file not found: ${this.modelPath}`);
    }
  }

  /** Detect model type from filename/extension */
  _detectModelType() {
    const lower = path.basename(this.modelPath).toLowerCase();
    if (lower.endsWith('.gguf')) return ModelType.LLAMA_CPP;
    if (lower.endsWith('.exl2') || lower.endsWith('.exl3')) return ModelType.EXLLAVA3;
    return ModelType.UNKNOWN;
  }

  /** Check if a native binding is available */
  static get hasNativeBinding() {
    try {
      // Attempt to require a native addon; returns true if available
      require('./ggml-node-addon'); // placeholder
      return true;
    } catch (_) {
      return false;
    }
  }

  /** Load the model in-process */
  async load() {
    if (this.isLoaded) return this;

    // TODO: When native addon is available:
    //   this.context = await GGMLNative.loadModel(this.modelPath, this.nCtx, this.nGpuLayers);
    //   this.isLoaded = true;

    // Placeholder: mark as loaded with mock data for interface compatibility
    this.isLoaded = true;
    this.context = {
      modelPath: this.modelPath,
      type: this.modelType,
      nCtx: this.nCtx,
      // nativeHandle: ... (would be set by native addon)
    };

    return this;
  }

  /** Generate text completion */
  async generate(prompt, params = {}) {
    if (!this.isLoaded) {
      await this.load();
    }

    // Merge with default params
    const sampling = {
      maxTokens: params.maxTokens ?? SamplingParams.maxTokens,
      temperature: params.temperature ?? SamplingParams.temperature,
      topP: params.topP ?? SamplingParams.topP,
      ...params,
    };

    // TODO: When native addon is available:
    //   return await GGMLNative.generate(this.context, prompt, sampling);

    // Placeholder: return a mock response
    return {
      status: 200,
      data: {
        message: {
          role: 'assistant',
          content: '[ggml binding not yet compiled - using placeholder]',
        },
        done: true,
        eval_count: 0,
        prompt_eval_count: 0,
      },
    };
  }

  /** Get model metadata */
  async getMeta() {
    if (!this.isLoaded) {
      await this.load();
    }

    return {
      model: path.basename(this.modelPath),
      type: this.modelType,
      nCtx: this.nCtx,
      nGpuLayers: this.nGpuLayers,
      isLoaded: this.isLoaded,
    };
  }

  /** Free/cleanup resources */
  async free() {
    this.isLoaded = false;
    this.context = null;
    this.embeddings = [];
    // TODO: native cleanup: GGMLNative.free(this.context);
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { GGMLBinding, ModelType, SamplingParams };

/*--------------------------------------------------------------------------
// Legacy export shape (for compatibility with require('../profiler') patterns)
---------------------------------------------------------------------------*/
module.exports.VERSION = '0.1.0';
module.exports.name = 'ggml-binding';
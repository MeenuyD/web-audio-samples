// Copyright (c) 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import Module from './synth.wasm.js';
import {FreeQueue} from '../lib/ring-buffer.js';

/* global sampleRate */

// Web Audio API's render block size
const NUM_FRAMES = 128;

class SynthProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Create an instance of Synthesizer and WASM memory helper. Then set up an
    // event handler for MIDI data from the main thread.
    this._freeQueue = new Module.Synthesizer(sampleRate);
    this._combinedBuffer = new FreeQueue(NUM_FRAMES, 1);
    this.port.onmessage = this._playTone.bind(this);
  }

  process(inputs, outputs) {
    // The output buffer (mono) provided by Web Audio API.
    const outputBuffer = outputs[0][0];

    // Call the render function to write into the WASM buffer. Then clone the
    // rendered data in the first channel to process() callback's output
    // buffer.
    this._freeQueue.render(this._combinedBuffer.getChannelData(), NUM_FRAMES);
    outputBuffer.set(this._combinedBuffer.getChannelData());

    return true;
  }

  _playTone(event) {
    const isDown = event.data;
    isDown ? this._freeQueue.noteOn(60) : this._freeQueue.noteOff(60);
  }
}

registerProcessor('wasm-synth', SynthProcessor);

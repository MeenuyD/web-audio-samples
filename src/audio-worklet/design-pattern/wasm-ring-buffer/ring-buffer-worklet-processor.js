/**
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

import Module from './variable-buffer-kernel.wasmmodule.js';
import {FreeQueue} from '../lib/ring-buffer.js';


/**
 * An example of AudioWorkletProcessor that uses RingBuffer inside. If your
 * audio processing function uses the buffer size other than 128 frames, using
 * RingBuffer can be a solution.
 *
 * Note that this example uses the WASM processor, but it can be utilized for
 * the ScriptProcessor's callback function with a bit of coordination.
 *
 * @class RingBufferWorkletProcessor
 * @extends AudioWorkletProcessor
 */
class RingBufferWorkletProcessor extends AudioWorkletProcessor {
  /**
   * @constructor
   * @param {Object} options AudioWorkletNodeOptions object passed from the
   * AudioWorkletNode constructor.
   */
  constructor(options) {
    super();

    this._kernelBufferSize = options.processorOptions.kernelBufferSize;
    this._channelCount = options.processorOptions.channelCount;

    // RingBuffers for input and output.
    this._buffer = new FreeQueue(this._kernelBufferSize, this._channelCount);

    // For WASM memory, also for input and output.
    this._heapInputBuffer =
      new Float32Array(Module.instance.exports.memory.buffer, 0, this._kernelBufferSize * this._channelCount);
    this._heapOutputBuffer =
      new Float32Array(Module.instance.exports.memory.buffer, this._kernelBufferSize * this._channelCount, this._kernelBufferSize * this._channelCount);


    // WASM audio processing kernel.
    this._kernel = new Module.VariableBufferKernel(this._kernelBufferSize);
  }

  /**
   * System-invoked process callback function.
   * @param  {Array} inputs Incoming audio stream.
   * @param  {Array} outputs Outgoing audio stream.
   * @param  {Object} parameters AudioParam data.
   * @return {Boolean} Active source flag.
   */
  process(inputs, outputs, parameters) {
    // Use the 1st input and output only to make the example simpler. |input|
    // and |output| here have the similar structure with the AudioBuffer
    // interface. (i.e. An array of Float32Array)
    const input = inputs[0];
    const output = outputs[0];

    // AudioWorkletProcessor always gets 128 frames in and 128 frames out. Here
    // we push 128 frames into the ring buffer.
    this._buffer.push(input, this._kernelBufferSize);

    // Process only if we have enough frames for the kernel.
    if (this._buffer.isFrameAvailable(this._kernelBufferSize)) {
      // Pull the queued data from the combined buffer.
      this._buffer.pull(this._heapInputBuffer, this._kernelBufferSize);

      // Process the data using the kernel.
      this._kernel.process(
        this._heapInputBuffer.byteOffset,
        this._heapOutputBuffer.byteOffset,
        this._channelCount
      );

      // Push the processed data back into the combined buffer.
      this._buffer.push(this._heapOutputBuffer, this._kernelBufferSize);
    }
    // if (this._inputRingBuffer.framesAvailable >= this._kernelBufferSize) {
    //   // Get the queued data from the input ring buffer.
    //   this._inputRingBuffer.pull(this._heapInputBuffer.getChannelData());

      // This WASM process function can be replaced with ScriptProcessor's
      // |onaudioprocess| callback funciton. However, if the event handler
      // touches DOM in the main scope, it needs to be translated with the
      // async messaging via MessagePort.


    // Always pull 128 frames out. If the ring buffer does not have enough
    // frames, the output will be silent.
    this._buffer.pull(output, this._kernelBufferSize);

    return true;
  }
}


registerProcessor('ring-buffer-worklet-processor', RingBufferWorkletProcessor);

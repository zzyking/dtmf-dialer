import React, { useState } from 'react';
import * as Tone from 'tone';
import { saveAs } from 'file-saver';
import styled from 'styled-components';

const DTMF_FREQS = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
};

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 50px;
  font-family: Arial, sans-serif;
`;

const Title = styled.h1`
  color: #333;
  margin-bottom: 20px;
`;

const InputContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 25px;
`;

const InputField = styled.input`
  font-size: 2rem;
  text-align: center;
  padding: 10px;
  border: 2px solid #ccc;
  border-radius: 5px 5px 5px 5px;
  width: 250px;
  margin-right: 5px;
`;

const DeleteButton = styled.button`
  font-size: 2rem;
  padding: 10px;
  background-color: #dc3545;
  color: white;
  border: 2px solid #ccc;
  border-left: 2px solid #ccc;
  border-radius: 5px 5px 5px 5px;
  cursor: pointer;

  &:hover {
    background-color: #c82333;
  }

  &:active {
    background-color: #bd2130;
  }
`;

const ButtonGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 75px);
  gap: 10px;
  margin-bottom: 20px;
`;

const Button = styled.button`
  font-size: 1.8rem;
  width: 70px;
  height: 70px;
  margin: 1px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;

  &:hover {
    background-color: #0056b3;
  }

  &:active {
    background-color: #003f7f;
  }
`;

const ActionButton = styled.button`
  margin-top: 10px;
  font-size: 1.75rem;
  padding: 10px 20px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;

  &:hover {
    background-color: #218838;
  }

  &:active {
    background-color: #1e7e34;
  }
`;

function App() {
  const [inputValue, setInputValue] = useState('');

  const playTone = async (digit) => {
    const [lowFreq, highFreq] = DTMF_FREQS[digit];

    const lowOsc = new Tone.Oscillator(lowFreq, "sine").toDestination();
    const highOsc = new Tone.Oscillator(highFreq, "sine").toDestination();

    const gain = new Tone.Gain(0.1).toDestination();

    lowOsc.connect(gain);
    highOsc.connect(gain);

    lowOsc.start();
    highOsc.start();

    setTimeout(() => {
      lowOsc.stop();
      highOsc.stop();
    }, 400);
  };

  const handleButtonClick = (digit) => {
    setInputValue(inputValue + digit);
    playTone(digit);
  };

  const handleDelete = () => {
    setInputValue(inputValue.slice(0, -1));
  };

  const generateAudio = () => {
    const sampleRate = 44100;
    const signalDuration = 0.05; // 50ms
    const silenceDuration = 0.05; // 50ms
    const signalSamples = Math.floor(sampleRate * signalDuration);
    const silenceSamples = Math.floor(sampleRate * silenceDuration);
    const totalSamples = (signalSamples + silenceSamples) * inputValue.length;
    let audioBuffer = new Float32Array(totalSamples);

    inputValue.split('').forEach((digit, i) => {
      const [lowFreq, highFreq] = DTMF_FREQS[digit];
      const tSignal = Array.from({ length: signalSamples }, (_, j) => j / sampleRate);
      const lowSignal = tSignal.map(t => Math.sin(2 * Math.PI * lowFreq * t));
      const highSignal = tSignal.map(t => Math.sin(2 * Math.PI * highFreq * t));
      const signal = lowSignal.map((val, j) => (val + highSignal[j]) * 0.5);
      const silence = new Float32Array(silenceSamples);

      audioBuffer.set(signal, i * (signalSamples + silenceSamples));
      audioBuffer.set(silence, i * (signalSamples + silenceSamples) + signalSamples);
    });

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = audioContext.createBuffer(1, audioBuffer.length, sampleRate);
    buffer.copyToChannel(audioBuffer, 0);

    const wav = audioBufferToWav(buffer);
    saveAs(new Blob([wav], { type: 'audio/wav' }), 'dtmf.wav');
  };

  const audioBufferToWav = (buffer) => {
    const numOfChan = buffer.numberOfChannels,
      length = buffer.length * numOfChan * 2 + 44,
      bufferArray = new ArrayBuffer(length),
      view = new DataView(bufferArray),
      channels = [],
      sampleRate = buffer.sampleRate;

    let offset = 0,
      pos = 0;

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this demo)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        const sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
        view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true); // convert to 16-bit PCM
        pos += 2;
      }
      offset++;
    }

    return bufferArray;

    function setUint16(data) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  };

  const renderButton = (digit) => (
    <Button
      key={digit}
      onMouseDown={() => handleButtonClick(digit)}
    >
      {digit}
    </Button>
  );

  return (
    <AppContainer>
      <Title>DTMF Dialer</Title>
      <InputContainer>
        <InputField
          type="text"
          value={inputValue}
          readOnly
        />
        <DeleteButton onMouseDown={handleDelete}>Del</DeleteButton>
      </InputContainer>
      <ButtonGrid>
        {['1', '2', '3'].map(renderButton)}
        {['4', '5', '6'].map(renderButton)}
        {['7', '8', '9'].map(renderButton)}
        {['*', '0', '#'].map(renderButton)}
      </ButtonGrid>
      <ActionButton onClick={generateAudio}>
        Generate Audio
      </ActionButton>
    </AppContainer>
  );
}

export default App;

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRideGate} from '../src/ride-gate.js';

test('motion waits for a stable body and plays the complete countdown', () => {
  const gate=createRideGate(true);
  assert.equal(gate(false,0).ride,false);
  assert.equal(gate(true,1000).message,'Hold steady');
  assert.equal(gate(true,1450).message,'3');
  assert.equal(gate(true,2450).message,'2');
  assert.equal(gate(true,3450).message,'1');
  assert.equal(gate(true,4450).ride,true);
});
test('pose loss resets the countdown; during play, brief misses do not pause', () => {
  const gate=createRideGate(true);
  gate(true,0);
  gate(false,1000,true);
  assert.equal(gate(true,3500).message,'Hold steady');
  assert.equal(gate(true,6950).ride,true);
  assert.equal(gate(false,7000,true).ride,true);
  assert.equal(gate(false,8000,false).ride,false);
  assert.equal(gate(true,8200).ride,true);
});
test('keyboard and touch can ride immediately', () => {
  assert.equal(createRideGate(false)(false,0).ride,true);
});

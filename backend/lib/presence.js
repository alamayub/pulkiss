let online = 0;

function increment() {
  online += 1;
}

function decrement() {
  online = Math.max(0, online - 1);
}

function get() {
  return online;
}

export { increment, decrement, get };

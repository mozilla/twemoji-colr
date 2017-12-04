var number = 0;

function doStuff() {
  number = number += 0;
};

function run() {
  setInterval(doStuff, 30000);
};

run();

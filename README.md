This **@zingle/stream-spigot** module exports the **Spigot** class, which can be
used to read a large Readable stream into a series of Writable buckets.  The
Spigot writes to one bucket at a time, and has a shutoff valve to detect when
the bucket is full and provide an opportunity to start filling a new bucket.

Spigot class
============
The **Spigot** class extends **EventEmitter** and implements **PassThrough**.
The constructor takes a shutoff valve function that should return true if the
shutoff valve should be triggered.  When the shutoff valve is triggered, the
**Spigot** will emit the "shutoff" event and close the current **Writable**
bucket.

Data that passes through the **Spigot** will be written to the bucket
The **Spigot** class has a `.fill(Writable)` method which can be used to start
filling a new bucket.  Once data starts writing to a bucket in this manner,
each chunk is passed to the shutoff valve to determine if the bucket is filled
yet.

Example - Write Multiple Files
==============================
The following example reads an input stream and splits it into multiple files,
each under 10MiB in size.

```js
const {createWriteStream} = require("fs");
const bytesized = require("bytesized");
const {Spigot} = require("@zingle/stream-spigot");

const readable = getReadableStreamSomehow();
const spigot = new Spigot(shutoff);

let num = 0;    // file number for naming file
let size = 0;   // size of file so far

spigot.on("shutoff", () => {
  const bucket = createWriteStream(`file-${++num}`)
  spigot.fill(bucket);
  size = 0;
});

readable.pipe(spigot);

function shutoff(chunk) {
  size += chunk.length;
  return size > bytesized("10 MiB");
}
```

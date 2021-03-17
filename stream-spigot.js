const {EventEmitter} = require("events");
const {PassThrough} = require("stream");
const spigot = Symbol();

/**
 * Use Readable to fill a series of Writable buckets.
 * @augments {EventEmitter}
 */
class Spigot extends PassThrough {
  /**
   * @param {function} [shutoff]
   */
  constructor(shutoff=()=>false) {
    super();
    EventEmitter.call(this);

    const buffer = [];
    const bucket = null;
    const shutoffEmitted = false;

    this[spigot] = {buffer, bucket, shutoff, shutoffEmitted};
  }

  /**
   * The current bucket being filled.
   * @type {Writable}
   */
  get bucket() {
    return this[spigot].bucket;
  }

  /**
   * True when a bucket is being filled.
   * @type {boolean}
   */
  get filling() {
    return Boolean(this.bucket);
  }

  /**
   * True if the "shutoff" event has been emitted for the current bucket.
   * @type {boolean}
   */
  get shutoffEmitted() {
    return this[spigot].shutoffEmitted;
  }

  /**
   * Cap the current bucket.
   */
  cap() {
    // if filling a bucket, cap it off and cork Spigot to wait for new bucket
    if (this.filling) {
      this.bucket.end();
      this[spigot].bucket = null;
      this.cork();
    }

    // reset shutoffEmitted flag so "shutoff" event triggers
    this[spigot].shutoffEmitted = false;
  }

  /**
   * Set a Writable bucket to fill from the Spigot.
   * @param {Writable} bucket
   */
  fill(bucket) {
    // cap the current bucket and replace with a new one
    this.cap();
    this[spigot].bucket = bucket;

    // uncork the Spigot and resume flow into new buckjet
    this.uncork();
    this.resume();
  }

  /**
   * @param {Buffer|string} chunk
   * @param {string} encoding
   * @param {function} callback
   */
  _transform(chunk, encoding, callback) {
    const {buffer, shutoff} = this[spigot];

    // first save chunk info to internal Spigot buffer
    buffer.push([chunk, encoding]);

    // if no bucket to fill, trigger "shutoff" event
    if (!this.filling) emitShutoff(this);

    // if Spigot has bucket to fill, copy buffer to Writable bucket
    while (this.filling && buffer.length && write(this, ...buffer.shift())) {
      // nothing to see here; everything already in the while condition
    }

    callback();

    function write(spigot, chunk, encoding) {
      // if shutoff valve triggers, re-buffer this chunk and cap the bucket
      if (shutoff(chunk, encoding)) {
        buffer.unshift([chunk, encoding]);
        if (spigot.filling) spigot.cap();
        emitShutoff(spigot);
        return false;
      }

      // if bucket filling too fast, wait for drain before contining
      if (false === spigot.bucket.write(chunk, encoding)) {
        spigot.cork();
        spigot.bucket.once("drain", () => this.uncork());
        return false;
      }

      // wrote chunk to bucket; can continue processing chunks
      return true;
    }
  }

  /**
   * @param {function} callback
   */
  _flush(callback) {
    this.cap();
  }
}

module.exports = {Spigot};

/**
 * Emit "shutoff" event if it has not been emitted yet.
 * @param {Spigot} instance
 */
function emitShutoff(instance) {
  if (!instance.shutoffEmitted) {
    instance[spigot].shutoffEmitted = true;
    instance.emit("shutoff");
  }
}

// mix EventEmitter into Spigot
Object.assign(Spigot.prototype, EventEmitter.prototype);

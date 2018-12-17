(function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return (b64.length * 3 / 4) - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr((len * 3 / 4) - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0; i < l; i += 4) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = ((uint8[i] << 16) & 0xFF0000) + ((uint8[i + 1] << 8) & 0xFF00) + (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  get: function () {
    if (!(this instanceof Buffer)) {
      return undefined
    }
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  get: function () {
    if (!(this instanceof Buffer)) {
      return undefined
    }
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('Invalid typed array length')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (isArrayBuffer(value) || (value && isArrayBuffer(value.buffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return fromObject(value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj) {
    if (ArrayBuffer.isView(obj) || 'length' in obj) {
      if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
        return createBuffer(0)
      }
      return fromArrayLike(obj)
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data)
    }
  }

  throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object.')
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (ArrayBuffer.isView(buf)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isArrayBuffer(string)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : new Buffer(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffers from another context (i.e. an iframe) do not pass the `instanceof` check
// but they should be treated as valid. See: https://github.com/feross/buffer/issues/166
function isArrayBuffer (obj) {
  return obj instanceof ArrayBuffer ||
    (obj != null && obj.constructor != null && obj.constructor.name === 'ArrayBuffer' &&
      typeof obj.byteLength === 'number')
}

function numberIsNaN (obj) {
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":1,"ieee754":3}],3:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],4:[function(require,module,exports){
var User = require('./CUser.js');
var Monster = require('./CMonster.js');

var util = require('../public/util.js');

var gameConfig = require('../public/gameConfig.json');
var objectAssign = require('../public/objectAssign.js');

// var map = require('../public/map.json');
var dataJson = require('../public/data.json');

var csvJson = require('../public/csvjson.js');
var csvJsonOption = {delimiter : ',', quote : '"'};

// var dataJson = require('../public/data.json');
var userStatTable = csvJson.toObject(dataJson.userStatData, csvJsonOption);
var resourceTable = csvJson.toObject(dataJson.resourceData, csvJsonOption);
var obstacleTable = csvJson.toObject(dataJson.obstacleData, csvJsonOption);
var mobTable = csvJson.toObject(dataJson.mobData, csvJsonOption);

// var obstacleTable = csvJson.toObject(dataJson.obstacleData, {delimiter : ',', quote : '"'});
// var userStatTable, resourceTable, obstacleTable, mobTable;

var QuadTree = require('../public/quadtree.js');

var Obstacle = require('./CObstacle.js');

var colliderEles = [];

var staticTree;
var staticEles = [];
var treeImgTree;
var treeImgEles = [];
// var collisionClearTime = Date.now();
var checkCollisionEles = [];
var affectedEles = [];

var CManager = function(){
	//user correspond client
	this.user = null;
	//all users
	this.users = [];
	this.monsters = [];
	this.chests = [];
	this.obstacles = [];
	this.immortalGrounds = [];
	this.portals = [];
	this.treesCount = 0;
	this.effects = [];
	this.userEffects = [];
	this.projectiles = [];
	this.riseText = [];

	this.userEffectTimer = Date.now();
	// this.objExps = [];
	this.objGolds = [];
	this.objJewels = [];
	this.objSkills = [];
	this.objBoxs = [];
	this.objBuffs = [];

	this.onUserLevelUp = new Function();
	this.onMainUserMove = new Function();
	this.onSkillFire = new Function();
	this.onProjectileSkillFire = new Function();

	this.staticInterval = null;
};

CManager.prototype = {
	start : function() { //statTable, srcTable, ostTable, mTable){
		// userStatTable = statTable;
		// resourceTable = srcTable;
		// obstacleTable = ostTable;
		// mobTable = mTable;

		staticTree = new QuadTree({
		  width : gameConfig.CANVAS_MAX_SIZE.width,
		  height : gameConfig.CANVAS_MAX_SIZE.height,
		  maxElements : 5
		});
		treeImgTree = new QuadTree({
		  width : gameConfig.CANVAS_MAX_SIZE.width,
		  height : gameConfig.CANVAS_MAX_SIZE.height,
		  maxElements : 5
		});

		this.mapSetting();
		this.updateGame();
	},
	mapSetting : function(){
		this.createObstacles();
		this.setEnvironments();
		// this.setObstaclesLocalPos();
	},
	updateGame : function(){
		var INTERVAL_TIMER = 1000/gameConfig.INTERVAL;
		// var INTERVAL_TIMER = 1000/30;

		if(this.staticInterval === null){
	    this.staticInterval = setInterval(staticIntervalHandler.bind(this), INTERVAL_TIMER);
	  }
	},
	createObstacles : function(){
		var rocks = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_ROCK));
		for(var i=0; i<Object.keys(rocks).length; i++){
			var resourceData = objectAssign({}, util.findData(resourceTable, 'index', rocks[i].imgData));
			var tempRock = new Obstacle(rocks[i].posX, rocks[i].posY, rocks[i].radius, rocks[i].id, resourceData);
			this.obstacles.push(tempRock);
			staticEles.push(tempRock.staticEle);
		}
		var chestGrounds = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_CHEST_GROUND));
		for(var i=0; i<Object.keys(chestGrounds).length; i++){
			var resourceData = objectAssign({}, util.findData(resourceTable, 'index', chestGrounds[i].imgData));
			var tempChestGround = new Obstacle(chestGrounds[i].posX, chestGrounds[i].posY, chestGrounds[i].radius, chestGrounds[i].id, resourceData);
			this.obstacles.push(tempChestGround);
			staticEles.push(tempChestGround.staticEle);
		}
		var trees = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_TREE));
		this.treesCount = Object.keys(trees).length;
		for(var i=0; i<Object.keys(trees).length; i++){
			var resourceData = objectAssign({}, util.findData(resourceTable, 'index', trees[i].imgData));
			var tempTree = new Obstacle(trees[i].posX, trees[i].posY, trees[i].radius, trees[i].id, resourceData);
			tempTree.setTreeImgEle(trees[i].treeImgRadius);
			this.obstacles.push(tempTree);
			staticEles.push(tempTree.staticEle);
			treeImgEles.push(tempTree.treeImgEle);
		}
		// for(var i=0; i<map.Trees.length; i++){
		// 	var tempObstacle = new Obstacle(map.Trees[i].posX, map.Trees[i].posY,	resources.OBJ_TREE_SIZE, resources.OBJ_TREE_SIZE, map.Trees[i].id, resources.OBJ_TREE_SRC);
		// 	this.obstacles.push(tempObstacle);
		// 	staticEles.push(tempObstacle.staticEle);
		// }
		// for(var i=0; i<map.Chests.length; i++){
		// 	var chestBase = new Obstacle(map.Chests[i].posX, map.Chests[i].posY, resources.OBJ_CHEST_SIZE, resources.OBJ_CHEST_SIZE, map.Chests[i].id, resources.OBJ_CHEST_SRC);
		// 	this.obstacles.push(chestBase);
		// 	staticEles.push(chestBase.staticEle);
		// }
		staticTree.pushAll(staticEles);
		treeImgTree.pushAll(treeImgEles);
	},
	setEnvironments : function(){
		var immortalGrounds = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.ENV_TYPE_IMMORTAL_GROUND));
		for(var i=0; i<Object.keys(immortalGrounds).length; i++){
			var resourceData = objectAssign({}, util.findData(resourceTable, 'index', immortalGrounds[i].imgData));
			var tempData = new Obstacle(immortalGrounds[i].posX, immortalGrounds[i].posY, immortalGrounds[i].radius, immortalGrounds[i].id, resourceData);
			tempData.size.width = (immortalGrounds[i].radius + 30) * 2;
			tempData.size.height = (immortalGrounds[i].radius + 30) * 2;
			this.immortalGrounds.push(tempData);
		}
		var portals = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.ENV_TYPE_PORTAL));
		for(var i=0; i<Object.keys(portals).length; i++){
			var resourceData = objectAssign({}, util.findData(resourceTable, 'index', portals[i].imgData));
			var tempData = new Obstacle(portals[i].posX, portals[i].posY, portals[i].radius, portals[i].id, resourceData);
			tempData.size.width = (portals[i].radius + 60) * 2;
			tempData.size.height = (portals[i].radius + 60) * 2;
			this.portals.push(tempData);
		}
	},
	setChests : function(chestDatas){
		for(var i=0; i<chestDatas.length; i++){
			this.createChest(chestDatas[i]);
		}
	},
	createChest : function(chestData){
		//find chest location
		var chestGrounds = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_CHEST_GROUND));
		for(var i=0; i<Object.keys(chestGrounds).length; i++){
			if(chestGrounds[i].id === chestData.lID){
				var chestGround = chestGrounds[i];
				var chestPosition = {x : chestGrounds[i].posX,  y : chestGrounds[i].posY};
				break;
			}
		}
		if(chestGround && chestPosition){
			// var resourceData = objectAssign({}, util.findData(resourceTable, 'index'))
			switch (chestData.gd) {
				case 1:
						var resourceIndex = gameConfig.RESOURCE_INDEX_CHEST_GRADE_1;
					break;
				case 2:
					resourceIndex = gameConfig.RESOURCE_INDEX_CHEST_GRADE_2;
					break;
				case 3:
					resourceIndex = gameConfig.RESOURCE_INDEX_CHEST_GRADE_3;
					break;
				case 4:
					resourceIndex = gameConfig.RESOURCE_INDEX_CHEST_GRADE_4;
					break;
				case 5:
					resourceIndex = gameConfig.RESOURCE_INDEX_CHEST_GRADE_5;
					break;
				default:
			}
			var resourceData = objectAssign({}, util.findData(resourceTable, 'index', resourceIndex));
			this.chests.push({
				objectID : chestData.oID,
				locationID : chestData.lID,
				grade : chestData.gd,
				HP : chestData.HP,
				maxHP : chestData.mHP,
				position : chestPosition,
				size : {width : chestGround.radius * 2, height : chestGround.radius * 2},
				center : {x : chestPosition.x + chestGround.radius, y : chestPosition.y + chestGround.radius},
				imgData : resourceData
			});
		}
		// for(var i=0; i<map.Chests.length; i++){
		// 	if(map.Chests[i].id === chestData.locationID){
		// 		var chestPosition = {x : map.Chests[i].posX, y : map.Chests[i].posY};
		// 		break;
		// 	}
		// }
		// if(chestPosition){
		// 	this.chests.push({
		// 		objectID : chestData.objectID,
		// 		grade : chestData.grade,
		// 		position : chestPosition,
		// 		size : {width : resources.OBJ_CHEST_SIZE, height : resources.OBJ_CHEST_SIZE}
		// 	});
		// }
	},
	updateChest : function(locationID, HP){
		for(var i=0; i<this.chests.length; i++){
			if(this.chests[i].locationID === locationID){
				this.chests[i].HP = HP;
				break;
			}
		}
	},
	deleteChest : function(locationID){
		for(var i=0; i<this.chests.length; i++){
			if(this.chests[i].locationID === locationID){
				this.chests.splice(i, 1)
				break;
			}
		}
	},
	setUser : function(userData, scaleFactor){
		if(!(userData.oID in this.users)){
			var cacheCanvas = util.makeCacheCanvas(userData.lv, userData.nm, scaleFactor);
			// var cacheCanvas = document.createElement('canvas');
			// var ctx = cacheCanvas.getContext('2d');
			// cacheCanvas.width = 400 * scaleFactor;
			// cacheCanvas.height = 100 * scaleFactor;
			// ctx.beginPath();
			// ctx.textAlign = "center";
			// ctx.fillStyle = "black";
			// ctx.font = "bold 15px Arial";
			// ctx.fillText("Lv." + userData.level + " " + userData.name, 200 * scaleFactor, 50 * scaleFactor, 200 * scaleFactor);
			// ctx.closePath();

			userData.imgData = this.setImgData(userData);
			var tempUser = new User(userData, cacheCanvas, scaleFactor);
			this.users[userData.oID] = tempUser;
			this.users[userData.oID].onMove = onMoveCalcCompelPos.bind(tempUser);
			this.users[userData.oID].changeState(userData.cs);
		}else{
			console.warn('user.objectID duplicated.');
		}
	},
	setUsers : function(userDatas, scaleFactor){
		for(var i=0; i<userDatas.length; i++){
			this.setUser(userDatas[i], scaleFactor);
			// userDatas[i].imgData = this.setImgData(userDatas[i], resourceTable, userStatTable);
			// var tempUser = new User(userDatas[i]);
			// this.users[userDatas[i].objectID] = tempUser;
			// this.users[userDatas[i].objectID].onMove = onMoveCalcCompelPos.bind(this);
			// this.users[userDatas[i].objectID].changeState(userDatas[i].currentState);
		}
	},
	setImgData : function(userData){
		var imgIndex = util.findDataWithTwoColumns(userStatTable, 'type', userData.tp, 'level', userData.lv).imgData;
		return objectAssign({}, util.findData(resourceTable, 'index', imgIndex));
	},
	setUsersSkills : function(skillDatas){
		for(var i=0; i<skillDatas.length; i++){
			if(skillDatas[i].fireTime > 0){
				this.userSkill(skillDatas[i].userID, skillDatas[i]);
			}
		}
	},
	setMobs : function(mobs){
		if(mobs){
			for(var i=0; i<mobs.length; i++){
				var mobData = util.findData(mobTable, 'index', mobs[i].id);
				var imgData = util.findData(resourceTable, 'index', mobData.resourceIndex);
				var mob = new Monster(mobs[i], imgData, mobData);
				this.monsters[mob.objectID] = mob;
				mob.onMove = onMoveCalcCompelPos.bind(mob);

				mob.setCenter();
				mob.setTargetDirection();
				mob.setSpeed();

				mob.changeState(mob.currentState);
				// this.monsters.push(mob);
			}
		}
	},
	changeStateMob : function(mobData){
		if(mobData.oID in this.monsters){
			var doUpdate = util.isRender(this.user, this.monsters[mobData.oID], mobData.tpos, 2000, 1500);

			this.monsters[mobData.oID].direction = mobData.dir;
			this.monsters[mobData.oID].rotateSpeed = mobData.rsp;
			this.monsters[mobData.oID].maxSpeed = mobData.msp;
			this.monsters[mobData.oID].attackTime = mobData.at;
			this.monsters[mobData.oID].conditions = mobData.cdt;

			if(doUpdate){
				this.monsters[mobData.oID].position = mobData.pos;
				this.monsters[mobData.oID].targetPosition = mobData.tpos;
				this.monsters[mobData.oID].setCenter();
				this.monsters[mobData.oID].setTargetDirection();
				this.monsters[mobData.oID].setSpeed();

				this.monsters[mobData.oID].changeState(mobData.cs);
			}else{
				this.monsters[mobData.oID].position = mobData.tpos;
				this.monsters[mobData.oID].setCenter();

				this.monsters[mobData.oID].changeState(gameConfig.OBJECT_STATE_IDLE);
			}
			// if(this.monsters[mobData.objectID].conditions[gameConfig.USER_CONDITION_FREEZE]){
			// 	this.monsters[mobData.objectID].changeState(gameConfig.OBJECT_STATE_IDLE);
			// }
		}
	},
	updateMob : function(mobData){
		if(mobData.oID in this.monsters){
			this.monsters[mobData.oID].HP = mobData.HP;

			this.monsters[mobData.oID].position = mobData.pos;
			this.monsters[mobData.oID].direction = mobData.dir;
			// this.monsters[mobData.objectID].maxSpeed = mobData.maxSpeed;
			// this.monsters[mobData.objectID].rotateSpeed = mobData.rotateSpeed;
			// this.monsters[mobData.objectID].attackTime = mobData.attackTime;
			// this.monsters[mobData.objectID].conditions = mobData.conditions;

			// this.monsters[mobData.objectID].targetPosition = mobData.targetPosition;
			// this.monsters[mobData.objectID].setCenter();
			// this.monsters[mobData.objectID].setTargetDirection();
			// this.monsters[mobData.objectID].setSpeed();

			// this.monsters[mobData.objectID].changeState(mobData.currentState);
		}
	},
	updateMobBuffImgData : function(mobID, buffImgDataList){
		if(mobID in this.monsters){
			this.monsters[mobID].updateBuffImgData(buffImgDataList);
		}
	},
	updateMobHitImgData : function(mobID, skillImgData){
		if(mobID in this.monsters){
			this.monsters[mobID].updateSkillHitImgData(skillImgData);
		}
	},
	deleteMob : function(mobID){
		if(mobID in this.monsters){
			this.monsters[mobID].stop();
			delete this.monsters[mobID];
		}
	},
	setObjs : function(objDatas){
		for(var i=0; i<objDatas.length; i++){
			// if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_EXP){
			// 	this.objExps.push({objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
			// }else
			if(objDatas[i].oID.substr(0, 1) === gameConfig.PREFIX_OBJECT_SKILL){
				this.objSkills.push(objDatas[i]);
					// {objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
			}else if(objDatas[i].oID.substr(0, 1) === gameConfig.PREFIX_OBJECT_GOLD){
				this.objGolds.push(objDatas[i]);
					// {objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
			}else if(objDatas[i].oID.substr(0, 1) === gameConfig.PREFIX_OBJECT_JEWEL){
				this.objJewels.push(objDatas[i]);
					// {objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
			}else if(objDatas[i].oID.substr(0, 1) === gameConfig.PREFIX_OBJECT_BOX){
				this.objBoxs.push(objDatas[i]);
			}else if(objDatas[i].oID.substr(0, 1) === gameConfig.PREFIX_OBJECT_BUFF){
				this.onNeedToGetObjBuffResource(objDatas[i]);
				this.objBuffs.push(objDatas[i]);
			}else{
				console.warn('check object : ' + objDatas[i].oID)
			}
		}
	},
	// createOBJs : function(objDatas){
	// 	for(var i=0; i<objDatas.length; i++){
	// 		// if(objDatas[i].objectID.substr(0,3) === gameConfig.PREFIX_OBJECT_EXP){
	// 		// 	this.objExps.push({objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
	// 		// }else
	// 		if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_SKILL){
	// 			this.objSkills.push(objDatas[i]);
	// 				// {objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
	// 		}else if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_GOLD){
	// 			this.objGolds.push(objDatas[i]);
	// 			// {objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
	// 		}else if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_JEWEL){
	// 			this.objJewels.push(objDatas[i]);
	// 			// {objectID : objDatas[i].objectID, position : objDatas[i].position, radius : objDatas[i].radius });
	// 		}else if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_BOX){
	// 			this.objBoxs.push(objDatas[i]);
	// 		}else if(objDatas[i].objectID.substr(0, 3) === gameConfig.PREFIX_OBJECT_BUFF){
	// 			this.onNeedToGetObjBuffResource(objDatas[i]);
	// 			this.objBuffs.push(objDatas[i]);
	// 		}else{
	// 			console.warn('check object : ' + objDatas[i].objectID)
	// 		}
	// 	}
	// },
	deleteOBJ : function(objID){
		// if(objID.substr(0,3) === gameConfig.PREFIX_OBJECT_EXP){
		// 	for(var i=0; i<this.objExps.length; i++){
		// 		if(this.objExps[i].objectID === objID){
		// 			this.objExps.splice(i, 1);
		// 			return;
		// 		}
		// 	}
		// }else
		if(objID.substr(0,1) === gameConfig.PREFIX_OBJECT_SKILL){
			for(var i=0; i<this.objSkills.length; i++){
				if(this.objSkills[i].oID === objID){
					this.objSkills.splice(i, 1);
					return;
				}
			}
		}else if(objID.substr(0,1) === gameConfig.PREFIX_OBJECT_GOLD){
			for(var i=0; i<this.objGolds.length; i++){
				if(this.objGolds[i].oID === objID){
					this.objGolds.splice(i, 1);
					return;
				}
			}
		}else if(objID.substr(0,1) === gameConfig.PREFIX_OBJECT_JEWEL){
			for(var i=0; i<this.objJewels.length; i++){
				if(this.objJewels[i].oID === objID){
					this.objJewels.splice(i, 1);
					return;
				}
			}
		}else if(objID.substr(0,1) === gameConfig.PREFIX_OBJECT_BOX){
			for(var i=0; i<this.objBoxs.length; i++){
				if(this.objBoxs[i].oID === objID){
					this.objBoxs.splice(i, 1);
					return;
				}
			}
		}else if(objID.substr(0,1) === gameConfig.PREFIX_OBJECT_BUFF){
			for(var i=0; i<this.objBuffs.length; i++){
				if(this.objBuffs[i].oID === objID){
					this.objBuffs.splice(i, 1);
					return;
				}
			}
		}else{
			console.warn('check object id : ' + objID);
		}
	},
	iamRestart : function(userData, scaleFactor){
		this.users[this.user.objectID] = this.user;
		var cacheCanvas = util.makeCacheCanvas(userData.lv, userData.nm, scaleFactor);

		// var cacheCanvas = document.createElement('canvas');
		// var ctx = cacheCanvas.getContext('2d');
		// cacheCanvas.width = 400;
		// cacheCanvas.height = 100;
		// ctx.beginPath();
		// ctx.textAlign = "center";
		// ctx.fillStyle = "black";
		// ctx.font = "bold 15px Arial";
		// ctx.fillText("Lv." + userData.level + " " + userData.name, 200, 50, 250);
		// ctx.closePath();

		this.user.updateTextCanvas(cacheCanvas);
		this.user.changeState(gameConfig.OBJECT_STATE_IDLE);
	},
	setUserInitState : function(objID){
		if(objID in this.users){
			this.users[objID].changeState(gameConfig.OBJECT_STATE_IDLE);
		}
	},
	iamDead : function(){
		this.user.hitImgDataList = [];
		this.user.buffImgDataList = [];
		this.user.conditions = [];
		// this.user.position = {x : -2000, y : -2000};
		this.user.changeState(gameConfig.OBJECT_STATE_DEATH);
	},
	kickUser : function(objID){
		if(!(objID in this.users)){
			console.log("user already out");
		}else{
			this.users[objID].stop();
			// this.users[objID].changeState(gameConfig.OBJECT_STATE_DEATH);
			delete this.users[objID];
		}
	},
	checkUserAtUsers : function(userData){
		if(userData.objectID in this.users){
			return true;
		}else{
			return false;
		}
	},
	//will be merge to updateUser function
	moveUser : function(targetPosition){
		this.user.targetPosition = targetPosition;
		this.user.setCenter();
		this.user.setTargetDirection();
		this.user.setSpeed();

		this.user.changeState(gameConfig.OBJECT_STATE_MOVE);
	},
	stopUser : function(){
		this.user.changeState(gameConfig.OBJECT_STATE_IDLE);
	},
	moveAndAttackUser : function(userID, userTargetPosition, skillData, moveBackward){
		var doUpdate = false;
		if(userID === this.user.objectID){
			doUpdate = true;
		}else{
			if(userID in this.users){
				doUpdate = util.isRender(this.user, this.users[userID], userTargetPosition)
			}else{
				doUpdate = false;
			}
		}
		if(userID in this.users && doUpdate){
			this.users[userID].setRenderVar(doUpdate);
			this.users[userID].targetPosition = userTargetPosition;
			this.users[userID].setCenter();
			if(moveBackward){
				this.users[userID].setTargetDirection(moveBackward);
				this.users[userID].setSpeed(gameConfig.MOVE_BACK_WARD_SPEED_DECREASE_RATE);
			}else{
				this.users[userID].setTargetDirection();
				this.users[userID].setSpeed();
			}

			skillData.direction = this.users[userID].targetDirection;
			var skillInstance = this.users[userID].makeSkillInstance(skillData);

			var thisUser = this.user;
			var mainUser = this.users[userID];
			var thisOnSkillFire = this.onSkillFire;

			skillInstance.onFire = function(syncFireTime){
				if(thisUser === mainUser){
					thisOnSkillFire(skillData, syncFireTime);
				}
				mainUser.skillCastEffectPlay = false;
			}
			this.users[userID].changeState(gameConfig.OBJECT_STATE_MOVE_AND_ATTACK);
			this.users[userID].setSkill(skillInstance);
			if(moveBackward){
				this.users[userID].isMoveBackward = true;
			}
		}
	},
	useSkill : function(userID, skillData){
		var doUpdate = false;
		if(!this.user){
			return true;
		}else if(userID === this.user.objectID){
			doUpdate = true;
		}else{
			if(userID in this.users){
				doUpdate = util.isRender(this.user, this.users[userID], skillData.targetPosition)
			}else{
				doUpdate = false;
			}
		}
		if(userID in this.users && doUpdate){
			this.users[userID].setRenderVar(doUpdate);
			var skillInstance = this.users[userID].makeSkillInstance(skillData);
			var thisUser = this.user;
			var mainUser = this.users[userID];
			// var thisProjectiles = this.projectiles;
			// var thisEffects = this.effects;
			var thisOnSkillFire = this.onSkillFire;
			var thisOnProjectileSkillFire = this.onProjectileSkillFire;

			this.users[userID].targetDirection = skillData.direction;
			if(skillData.type === gameConfig.SKILL_TYPE_INSTANT_RANGE){
				skillInstance.onFire = function(syncFireTime){
					//inform to server
					if(thisUser === mainUser){
						thisOnSkillFire(skillData, syncFireTime);
					}

					mainUser.skillCastEffectPlay = false;
					// skillInstance.startEffectTimer();
					// thisEffects.push(skillInstance.effect);
				};
				//on attack can cast skill but on attack cant attack;
				this.users[userID].changeState(gameConfig.OBJECT_STATE_ATTACK);
			}else if(skillData.type === gameConfig.SKILL_TYPE_INSTANT_PROJECTILE){
				skillInstance.onFire = function(syncFireTime){
					var projectile = mainUser.makeProjectile(skillData.projectileIDs[0], skillInstance, skillData.direction);
					if(thisUser === mainUser){
						thisOnProjectileSkillFire([projectile], syncFireTime);
					}
					// thisProjectiles.push(projectile);
					mainUser.skillCastEffectPlay = false;
				}
				//on attack can cast skill but on attack cant attack;
				this.users[userID].changeState(gameConfig.OBJECT_STATE_ATTACK);
			}else if(skillData.type === gameConfig.SKILL_TYPE_RANGE || skillData.type === gameConfig.SKILL_TYPE_SELF ||
				skillData.type === gameConfig.SKILL_TYPE_SELF_EXPLOSION || skillData.type === gameConfig.SKILL_TYPE_TELEPORT){
					skillInstance.onFire = function(syncFireTime){
						if(thisUser === mainUser){
							thisOnSkillFire(skillData, syncFireTime)
						}
						mainUser.skillCastEffectPlay = false;
						// skillInstance.startEffectTimer();
						// thisEffects.push(skillInstance.effect);
					};
					this.users[userID].changeState(gameConfig.OBJECT_STATE_CAST);
				}else if(skillData.type === gameConfig.SKILL_TYPE_PROJECTILE || skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK ||
					skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION || skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION){
						skillInstance.onFire = function(syncFireTime){
							var projectiles = [];
							var direction = skillData.direction;
							for(var i=0; i<skillData.projectileCount; i++){
								if(skillData.projectileCount % 2 === 0){
									var midPoint = skillData.projectileCount/2 - 0.5;
									var factor = i - midPoint;
									direction = skillData.direction + factor * gameConfig.MULTI_PROJECTILE_DEGREE;
								}else if(skillData.projectileCount % 2 === 1){
									var midPoint = Math.floor(skillData.projectileCount/2);
									factor = i - midPoint;
									direction = skillData.direction + factor * gameConfig.MULTI_PROJECTILE_DEGREE;
								}
								var projectile = mainUser.makeProjectile(skillData.projectileIDs[i], skillInstance, direction);
								// thisProjectiles.push(projectile);
								projectiles.push(projectile);
								if(thisUser === mainUser && projectiles.length === skillData.projectileCount){
									thisOnProjectileSkillFire(projectiles, syncFireTime);
								}
								mainUser.skillCastEffectPlay = false;
							}
						};
						this.users[userID].changeState(gameConfig.OBJECT_STATE_CAST);
					}else{
						console.warn('skill type error!!!');
					}
			this.users[userID].setSkill(skillInstance);
		}
	},
	applySkill : function(skillData, userID, imgData){
		if(skillData.type === gameConfig.SKILL_TYPE_TELEPORT){
			if(userID in this.users){
				if(skillData.targetPosition.x < this.users[userID].size.width/2){
					skillData.targetPosition.x = this.users[userID].size.width/2;
				}else if(skillData.targetPosition.x > gameConfig.CANVAS_MAX_SIZE.width - this.users[userID].size.width/2){
					skillData.targetPosition.x = gameConfig.CANVAS_MAX_SIZE.width - this.users[userID].size.width/2;
				}
				if(skillData.targetPosition.y < this.users[userID].size.height/2){
					skillData.targetPosition.y = this.users[userID].size.height/2;
				}else if(skillData.targetPosition.y > gameConfig.CANVAS_MAX_SIZE.height - this.users[userID].size.height/2){
					skillData.targetPosition.y = gameConfig.CANVAS_MAX_SIZE.height - this.users[userID].size.height/2;
				}
				var newPosition = {x : skillData.targetPosition.x,
													 y : skillData.targetPosition.y}
				this.moveUserToNewPos(userID, newPosition);
				// this.users[userID].changePosition(newPosition);
				// if(userID === this.user.objectID){
				// 	this.onMainUserMove(this.user);
				// }
			}
		}else{
			this.effects.push({
				property : skillData.property,
				position : {x : skillData.targetPosition.x - skillData.explosionRadius,
					y : skillData.targetPosition.y - skillData.explosionRadius},
				radius : skillData.explosionRadius,
				startTime : Date.now(),
				lifeTime  : skillData.effectLastTime,
				scaleFactor : 1,

				effectImgData : imgData ? imgData : 0,

				isCheckCollision : false
			});
		}
	},
	applyProjectile : function(skillData, pImgData, eImgData){
		this.projectiles.push({
			userID : skillData.userID,
			objectID : skillData.objectID,

			type : skillData.type,
			property : skillData.property,

			position : skillData.position,
			speed : skillData.speed,
			startTime : skillData.startTime,
			radius : skillData.radius,
			lifeTime : skillData.lifeTime * 2,

			projectileImgData : pImgData ? pImgData : 0,
			effectRotateDegree : 0,
			effectTimer : Date.now(),

			timer : Date.now(),
			effect : {
				property : skillData.property,
				position : skillData.position,
				radius : skillData.explosionRadius,
				startTime : 0,
				lifeTime : skillData.effectLastTime,
				effectImgData : eImgData ? eImgData : 0,
				scaleFactor : 1
			},
			move : function(){
				var deltaTime = (Date.now() - this.timer)/ 1000;
		    this.position.x += this.speed.x * deltaTime;
		    this.position.y += this.speed.y * deltaTime;
		    this.timer = Date.now();
			},
			isExpired : function(){
		    if(this.lifeTime > Date.now() - this.startTime){
		      return false;
		    }
				console.log('server response to late!!!, in projectile expired');
		    return true;
		  },
			explode : function(position){
				this.setEffect(position);
				// console.log('explode!!!!!!');
			},
			setEffect : function(position){
				this.effect.position = position;
				this.effect.startTime = Date.now();
			}
		});
	},
	applyCastSpeed : function(userID, skillData){
		if(userID in this.users){
			skillData.fireTime = Math.floor(skillData.fireTime * (100 / this.users[userID].castSpeed));
			skillData.totalTime = Math.floor(skillData.totalTime * (100 / this.users[userID].castSpeed));
		}
	},
	deleteProjectile : function(projectileID, userID){
		for(var i=0; i<this.projectiles.length; i++){
			if(this.projectiles[i].objectID === projectileID){
				if(this.projectiles[i].userID === userID){
					this.projectiles.splice(i, 1);
					break;
				}
			}
		}
	},
	explodeProjectile : function(projectileID, userID, position){
		for(var i=0; i<this.projectiles.length; i++){
			if(this.projectiles[i].objectID === projectileID){
				if(this.projectiles[i].userID === userID){
					this.projectiles[i].explode(position);
					// this.projectiles[i].startEffectTimer();
					this.effects.push(this.projectiles[i].effect);
					this.projectiles.splice(i, 1);
					break;
				}
			}
		}
	},
	changeUserStat : function(userData, isUpdateImage, scaleFactor){
		if(userData.oID in this.users){
			if(userData.lv !== this.users[userData.oID].level || isUpdateImage){
				if(userData.lv !== this.users[userData.oID].level){
					var cacheCanvas = util.makeCacheCanvas(userData.lv, this.users[userData.oID].name, scaleFactor);
					this.users[userData.oID].updateTextCanvas(cacheCanvas);
				}
				this.users[userData.oID].level = userData.lv;
				this.users[userData.oID].imgData = this.setImgData(userData);
				if(userData.oID === this.user.objectID){
					this.onUserLevelUp(userData.lv);
				}
			}
			this.users[userData.oID].exp = userData.ep;

			this.users[userData.oID].maxHP = userData.mHP;
			this.users[userData.oID].maxMP = userData.mMP;
			this.users[userData.oID].HP = userData.HP;
			this.users[userData.oID].MP = userData.MP;
			this.users[userData.oID].castSpeed = userData.csp;
			this.users[userData.oID].maxSpeed = userData.msp;
			this.users[userData.oID].rotateSpeed = userData.rsp;
			this.users[userData.oID].conditions = userData.cdt;
			// this.users[userData.oID].buffList = userData.buffList;
			// this.users[userData.oID].passiveList = userData.passiveList;

			//apply maxSpeed
			this.users[userData.oID].setSpeed();

			if(this.users[userData.oID].currentState === gameConfig.OBJECT_STATE_CAST &&
				 this.users[userData.oID].currentSkill){
				var consumeMP = this.users[userData.oID].currentSkill.consumeMP;
				if(this.users[userData.oID].conditions[gameConfig.USER_CONDITION_FREEZE] ||
					 this.users[userData.oID].conditions[gameConfig.USER_CONDITION_SILENCE] ||
					 this.users[userData.oID].conditions[gameConfig.USER_CONDITION_BLUR] ||
					 this.users[userData.oID].MP < consumeMP){
						 this.users[userData.oID].changeState(gameConfig.OBJECT_STATE_IDLE);
					 }
			}else if(this.users[userData.oID].currentState === gameConfig.OBJECT_STATE_ATTACK){
				if(this.users[userData.oID].conditions[gameConfig.USER_CONDITION_FREEZE] ||
					 this.users[userData.oID].conditions[gameConfig.USER_CONDITION_SILENCE] ||
				 	 this.users[userData.oID].conditions[gameConfig.USER_CONDITION_BLUR]){
					this.users[userData.oID].changeState(gameConfig.OBJECT_STATE_IDLE);
				}
			}
		}
	},
	moveUserToNewPos : function(userID, newPos){
		if(userID in this.users){
			this.users[userID].changePosition(newPos);
			this.users[userID].changeState(gameConfig.OBJECT_STATE_IDLE);
			// this.users[userID].stop();
			if(userID === this.user.objectID){
				this.onMainUserMove(this.user);
			}
		}
	},
	updateSkillPossessions : function(userID, possessSkills){
		if(userID in this.users){
			this.users[userID].updateSkillPossessions(possessSkills);
		}
	},
	setUserData : function(userData){
		if(userData.oID in this.users){
			this.users[userData.oID].name = userData.nm;
			this.users[userData.oID].position = userData.pos;
			this.users[userData.oID].targetPosition = userData.tpos;

			this.users[userData.oID].direction = userData.dir;
			this.users[userData.oID].maxSpeed = userData.msp;
			this.users[userData.oID].rotateSpeed = userData.rsp;

			this.users[userData.oID].setCenter();
			this.users[userData.oID].setTargetDirection();
			this.users[userData.oID].setSpeed();

			this.users[userData.oID].changeState(userData.cs);
		}
	},
	updateUserData : function(userData){
		var doUpdate = false;
		if(!this.user){
			return true;
		}else if(userData.oID === this.user.oID){
			doUpdate = true;
		}else{
			if(userData.oID in this.users){
				doUpdate = util.isRender(this.user, this.users[userData.oID], userData.tpos);
			}else{
				doUpdate = false;
			}
		}
		if(userData.oID in this.users && this.users[userData.oID].currentState !== gameConfig.OBJECT_STATE_DEATH){
			this.users[userData.oID].setRenderVar(doUpdate);
			this.users[userData.oID].position = userData.pos;
			this.users[userData.oID].targetPosition = userData.tpos;

			this.users[userData.oID].direction = userData.dir;
			this.users[userData.oID].maxSpeed = userData.msp;
			this.users[userData.oID].rotateSpeed = userData.rsp;

			this.users[userData.oID].setCenter();
			this.users[userData.oID].setTargetDirection();
			this.users[userData.oID].setSpeed();

			if(doUpdate){
				this.users[userData.oID].changeState(userData.cs);
			}else{
				this.users[userData.oID].changeState(gameConfig.OBJECT_STATE_IDLE);
			}
		}
	},
	syncUserData : function(userData){
		var doUpdate = false;
		if(!this.user){
			doUpdate = true;
		}else if(userData.oID === this.user.oID){
			doUpdate = true;
		}else{
			if(userData.oID in this.users){
				doUpdate = util.isRender(this.user, this.users[userData.oID], userData.tpos);
			}else{
				doUpdate = false;
			}
		}
		if(userData.oID in this.users){
			this.users[userData.oID].position = userData.pos;
			if(doUpdate){
				if(this.users[userData.oID].currentState !== gameConfig.OBJECT_STATE_ATTACK &&
					this.users[userData.oID].currentState !== gameConfig.OBJECT_STATE_CAST){
						this.users[userData.oID].targetPosition = userData.tpos;

						this.users[userData.oID].direction = userData.dir;
						this.users[userData.oID].maxSpeed = userData.msp;
						this.users[userData.oID].rotateSpeed = userData.rsp;

						this.users[userData.oID].setCenter();
						this.users[userData.oID].setTargetDirection();
						this.users[userData.oID].setSpeed();
				}
				if(this.users[userData.oID].currentState !== userData.cs &&
					this.users[userData.oID].currentState !== gameConfig.OBJECT_STATE_CAST &&
					this.users[userData.oID].currentState !== gameConfig.OBJECT_STATE_ATTACK &&
					this.users[userData.oID].currentState !== gameConfig.OBJECT_STATE_MOVE_AND_ATTACK){
						this.users[userData.oID].changeState(userData.cs);
				}
			}
		}
	},
	updateUserBuffImgData : function(userID, buffImgDataList){
		if(userID in this.users){
			this.users[userID].updateBuffImgData(buffImgDataList);
		}
	},
	updateSkillHitImgData : function(userID, skillImgData){
		if(userID in this.users){
			this.users[userID].updateSkillHitImgData(skillImgData);
		}
	},
	// set this client user
	synchronizeUser : function(userID){
		for(var index in this.users){
			if(this.users[index].objectID === userID){
				this.user = this.users[index];
				this.user.onMainUserMove = onMainUserMoveHandler.bind(this, this.user);
			}
		}
		if(!this.user){
			console.log('if print me. Something is wrong');
		}
	},
	getUserCurrentState : function(userID){
		if(userID in this.users){
			return this.users[userID].getCurrentState();
		}
	},
	getUserCurrentSkillIndex : function(userID){
		if(userID in this.users){
			return this.users[userID].getCurrentSkillIndex();
		}
	},
	getUserPosition : function(userID){
		if(userID in this.users){
			return {
				x : Math.floor(this.users[userID].position.x),
				y : Math.floor(this.users[userID].position.y)
			}
		}
	},
	getUserExp : function(){
		if (this.user) {
			return this.user.exp;
		}
		// if(userID in this.users){
		// 	return this.users[userID].exp;
		// }
	},
	getUserHP : function(userID){
		if(userID in this.users){
			return this.users[userID].HP;
		}
	},
	getUserMP : function(userID){
		if(userID in this.users){
			return this.users[userID].MP;
		}
	},
	processUserData : function(){
		return {
			objectID : this.user.objectID,
			currentState : this.user.currentState,
			position : { x : Math.floor(this.user.position.x), y : Math.floor(this.user.position.y) },
			direction : Math.floor(this.user.direction),

			time : this.user.timer
		};
	},
	processSkillData : function(skillData){
		return {
			// userID : this.user.objectID,
			sID : skillData.index,
			sTPos : { x : Math.floor(skillData.targetPosition.x), y : Math.floor(skillData.targetPosition.y) }
		};
	},
	processProjectileData : function(projectileDatas){
		var projectiles = [];
		for(var i=0; i<projectileDatas.length; i++){
			projectiles.push({
				oID : projectileDatas[i].objectID,
				sID : projectileDatas[i].index,
				pos : { x : Math.floor(projectileDatas[i].position.x), y : Math.floor(projectileDatas[i].position.y) },
				sp : projectileDatas[i].speed
				// startTime : projectileDatas[i].startTime,
				// lifeTime : projectileDatas[i].lifeTime
			});
		}
		return projectiles;
	},
	checkCollisionWithObstacles : function(targetPosition, user){
		var collisionObjs = util.checkCircleCollision(staticTree, targetPosition.x - user.size.width/2, targetPosition.y - user.size.height/2, user.size.width/2, user.objectID);
		return collisionObjs;
	},
	reCalcSkillTargetPosition : function(targetPosition, user, collisionObjs){
		var collisionObj = [collisionObjs[0]];
		var addPos = util.calcCompelPos({
			x : targetPosition.x - user.size.width/2,
			y : targetPosition.y - user.size.height/2,
			width : user.size.width,
			height : user.size.height,
			id : user.objectID
		}, collisionObj);
		return {
			x : targetPosition.x + addPos.x,
			y : targetPosition.y + addPos.y
		}
	},
	setUserChatMsg : function(userID, msg){
		if(userID in this.users){
			this.users[userID].setChatMsg(msg);
		}
	},
	resetUsers : function(userDatas, scaleFactor){
		this.users = [];
		this.setUsers(userDatas, scaleFactor);
	},
	resetObjs : function(objDatas){
		this.objSkills = [];
		this.objGolds = [];
		this.objJewels = [];
		this.objBoxs = [];
		this.objBuffs = [];
		this.setObjs(objDatas);
	},
	resetChests : function(chestDatas){
		this.chests = [];
		this.setChests(chestDatas);
	},
	resetMobs : function(mobDatas){
		this.monsters = [];
		this.setMobs(mobDatas);
	}
};

function staticIntervalHandler(){
	// var clearImg = false;
	// if(Date.now() - collisionClearTime >= gameConfig.IMG_COLLISION_CLEAR_TIME){
	// 	clearImg = true;
	// 	collisionClearTime = Date.now();
	// 	for(var i=0; i<this.obstacles.length; i++){
	// 		// if(this.obstacles[i].treeImgEle){
	// 		// 	this.obstacles[i].treeImgEle.isCollide = false;
	// 		// }
	// 		this.obstacles[i].staticEle.isCollide = false;
	// 	}
	// }
	for(var i=this.userEffects.length - 1; i>=0; i--){
		if(Date.now() - this.userEffects[i].startTime >= this.userEffects[i].resourceLifeTime){
			this.userEffects.splice(i, 1);
		}else if(Date.now() - this.userEffects[i].effectTimer >= gameConfig.USER_DETACH_EFFECT_CHANGE_TIME){
			this.userEffects[i].changeIndex();
		}
	}
	if(Date.now() - this.userEffectTimer >= gameConfig.USER_DETACH_EFFECT_MAKE_TIME){
		for(var index in this.users){
			if(this.users[index].isRender){
				for(var i=0; i<this.users[index].buffImgDataList.length; i++){
					if(!this.users[index].buffImgDataList[i].isAttach){
						var userEffect = util.makeUserEffect(this.users[index], this.users[index].buffImgDataList[i]);
						this.userEffects.push(userEffect);
					}
				}
			}
		}
		for(var index in this.monsters){
			for(var i=0; i<this.monsters[index].buffImgDataList.length; i++){
				if(!this.monsters[index].buffImgDataList[i].isAttach){
					var userEffect = util.makeUserEffect(this.monsters[index], this.monsters[index].buffImgDataList[i]);
					this.userEffects.push(userEffect);
				}
			}
		}
		this.userEffectTimer = Date.now();
	}
	if(this.user){
		var collisionObjs = util.checkCircleCollision(treeImgTree, this.user.position.x, this.user.position.y, this.user.size.width/2, this.user.objectID);
		if(collisionObjs.length){
			for(var i=0; i<collisionObjs.length; i++){
				tempCollider = collisionObjs[i];
				if(!collisionObjs[i].isCollide){
					tempCollider.isCollide = true;
					// setTimeout(function(){
					// 	tempCollider.isCollide = false;
					// }, 500);
				}
			}
		}
	}
	var i=checkCollisionEles.length;
	while(i--){
		var collisionObjs = util.checkCircleCollision(staticTree, checkCollisionEles[i].position.x, checkCollisionEles[i].position.y, checkCollisionEles[i].radius, gameConfig.PREFIX_SKILL);
		if(collisionObjs.length){
			for(var j=0; j<collisionObjs.length; j++){
				var tempCollider = collisionObjs[j];
				if(!tempCollider.isCollide){
					tempCollider.isCollide = true;
					// setTimeout(function(){
					// 	tempCollider.isCollide = false;
					// }, gameConfig.SKILL_HIT_EFFECT_TIME);
				}
			}
		}
		checkCollisionEles.splice(i, 1);
	}

	//user elements update for collision check
	for(var index in this.users){
		this.users[index].setEntityEle();
	}
	for(var index in this.monsters){
		this.monsters[index].setEntityEle();
	}
	var i = this.projectiles.length;
  while(i--){
    if(this.projectiles[i].isExpired()){
      this.projectiles.splice(i, 1);
    }else{
      this.projectiles[i].move();
			if(this.projectiles[i].projectileImgData){
				if(Date.now() - this.projectiles[i].effectTimer >= gameConfig.PROJECTILE_EFFECT_CHANGE_TIME) {
					this.projectiles[i].effectTimer = Date.now();
					this.projectiles[i].effectRotateDegree += 10;
				}
			}
			if(this.projectiles[i].type === gameConfig.SKILL_TYPE_INSTANT_PROJECTILE || this.projectiles[i].type === gameConfig.SKILL_TYPE_PROJECTILE ||
				 this.projectiles[i].type === gameConfig.SKILL_TYPE_PROJECTILE_TICK || this.projectiles[i].type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION){
					 //check collision with obstacles
					 var collisionObjs = util.checkCircleCollision(staticTree, this.projectiles[i].position.x, this.projectiles[i].position.y, this.projectiles[i].radius, gameConfig.PREFIX_SKILL_PROJECTILE);
					 if(collisionObjs.length){
						 for(var j=0; j<collisionObjs.length; j++){
							 var tempCollider = collisionObjs[j];
							 if(tempCollider.id.substr(0,1) !== gameConfig.PREFIX_OBSTACLE_CHEST_GROUND && !tempCollider.isCollide){
								 tempCollider.isCollide = true;
								 // setTimeout(function(){
									//  tempCollider.isCollide = false;
								 // }, gameConfig.SKILL_HIT_EFFECT_TIME);
							 }
						 }
					 }
				 }
		}
  }
	var i=this.effects.length;
	while(i--){
		if(!this.effects[i].isCheckCollision){
			if(Date.now() - this.effects[i].startTime > this.effects[i].lifeTime/2){
				checkCollisionEles.push(this.effects[i]);
				this.effects[i].isCheckCollision = true;
			}
		}
		if(this.effects[i].startTime + this.effects[i].lifeTime < Date.now()){
			this.effects.splice(i, 1);
		}else{
			this.effects[i].scaleFactor = util.interpolationSine(Date.now() - this.effects[i].startTime, this.effects[i].lifeTime);
		}
	}
};
var onMoveCalcCompelPos = function(){
	var collisionObjs = util.checkCircleCollision(staticTree, this.entityTreeEle.x, this.entityTreeEle.y, this.entityTreeEle.width/2, this.entityTreeEle.id);
  if(collisionObjs.length > 0 ){
    var addPos = util.calcCompelPos(this.entityTreeEle, collisionObjs);
  }
  return addPos;
};
var onMainUserMoveHandler = function(user){
	this.onMainUserMove(user);
}
module.exports = CManager;

},{"../public/csvjson.js":11,"../public/data.json":12,"../public/gameConfig.json":13,"../public/objectAssign.js":15,"../public/quadtree.js":16,"../public/util.js":18,"./CMonster.js":5,"./CObstacle.js":6,"./CUser.js":9}],5:[function(require,module,exports){
var util = require('../public/util.js');
var gameConfig = require('../public/gameConfig.json');

var INTERVAL_TIMER = 1000/30;

var Monster = function(mobData, imgData, data){
  this.objectID = mobData.oID;
  this.currentState = mobData.cs;
  this.position = mobData.pos;
  this.targetPosition = mobData.tpos;
  this.maxSpeed = mobData.msp;
  this.direction = mobData.dir;
  this.rotateSpeed = mobData.rsp;
  this.attackTime = mobData.at;
  this.size = {width: data.size, height: data.size};
  // this.size = mobData.size;
  this.center = {x : this.position.x + this.size.width/2, y : this.position.y + this.size.height/2};
  this.speed = {x : 0, y : 0};

  this.maxHP = mobData.mHP;
  this.HP = mobData.HP;
  this.conditions = mobData.cdt;

  this.isAttack = false;
  this.attackDegree = 0;

  this.isRender = false;
  this.imgData = imgData;
  // this.imgRatio = imgRatio || 1;
  // mobData.imgRatio/100
  this.imgRatio = data.imgRatio/100 || 1;
  this.hitImgDataList = [];
  this.buffImgDataList = [];

  this.effectTimer = Date.now();
  this.effectIndex = 0;
  this.effectRotateDegree = 0;

  this.entityTreeEle = {
    x : this.position.x,
    y : this.position.y,
    width : this.size.width,
    height : this.size.height,
    id : this.objectID
  };

  this.timer = Date.now();

  this.updateInterval = false;
  this.updateFunction = new Function();

  this.onMove = new Function();
}
Monster.prototype = {
  changeState : function(newState){
    this.currentState = newState;

    this.stop();
    switch (this.currentState) {
      case gameConfig.OBJECT_STATE_IDLE:
        this.updateFunction = this.idle.bind(this);
        break;
      case gameConfig.OBJECT_STATE_MOVE:
        this.updateFunction = this.rotate.bind(this);
        break;
      case gameConfig.OBJECT_STATE_ATTACK:
        this.updateFunction = this.attack.bind(this);
        break;
      case gameConfig.OBJECT_STATE_DEATH:
        this.updateFunction = this.idle.bind(this);
        break;
    }
    this.update();
  },
  update : function(){
    this.updateInterval = setInterval(this.updateFunction, INTERVAL_TIMER);
  },
  setCenter : function(){
    this.center.x = this.position.x + this.size.width/2,
    this.center.y = this.position.y + this.size.height/2
  },
  idle : function(){
    this.doEveryTick();
  },
  rotate : function(){
    var deltaTime = (Date.now() - this.timer)/1000;
    util.rotate.call(this, deltaTime);
    this.doEveryTick();
  },
  move : function(deltaTime, isMoveSlight){
    if(isMoveSlight){
      util.move.call(this, deltaTime, isMoveSlight)
    }else{
      util.move.call(this, deltaTime);
    }
  },
  attack : function(){
    var deltaTime = (Date.now() - this.timer) / this.attackTime;
    this.attackDegree += 25 * deltaTime;
    // console.log('attack');
    this.doEveryTick();
  },
  setTargetDirection : function(){
    util.setTargetDirection.call(this);
  },
  setSpeed : function(){
    util.setSpeed.call(this);
  },
  stop : function(){
    this.attackDegree = 0;
    if(this.updateInterval){
      clearInterval(this.updateInterval);
      this.updateInterval = false;
    }
  },
  doEveryTick : function(){
    this.timer = Date.now();
    for(var i=this.hitImgDataList.length - 1; i>=0; i--){
      if(Date.now() - this.hitImgDataList[i].startTime >= this.hitImgDataList[i].resourceLifeTime){
        this.hitImgDataList.splice(i, 1);
      }
    }
    if(this.isRender){
      if(Date.now() - this.effectTimer >= gameConfig.USER_ATTACH_EFFECT_CHANGE_TIME){
        this.effectTimer = Date.now();
        this.effectRotateDegree += 10;
        if(this.effectIndex > 100){
          this.effectIndex = 0;
        }else{
          this.effectIndex += 1;
        }
        if(this.effectRotateDegree >= 360){
          this.effectRotateDegree -= 360;
        }
      }
    }
  },
  updateBuffImgData : function(buffImgDataList){
    // this.buffImgDataList = buffImgDataList;
    this.buffImgDataList = [];
    for(var i=0; i<buffImgDataList.length; i++){
      for(var j=0; j<buffImgDataList[i].resourceLength; j++){
        buffImgDataList[i]['resourceIndex' + (j + 1)].width *= this.imgRatio;
        buffImgDataList[i]['resourceIndex' + (j + 1)].height *= this.imgRatio;
      }
      this.buffImgDataList.push(buffImgDataList[i]);
    }
  },
  updateSkillHitImgData : function(skillImgData){
    skillImgData.startTime = Date.now();
    for(var i=0; i<skillImgData.resourceLength; i++){
      skillImgData['resourceIndex' + (i + 1)].width *= this.imgRatio;
      skillImgData['resourceIndex' + (i + 1)].height *= this.imgRatio;
    }
    this.hitImgDataList.push(skillImgData);
  },
  setEntityEle : function(){
    this.entityTreeEle = {
      x : this.position.x,
      y : this.position.y,
      width : this.size.width,
      height : this.size.height,
      id : this.objectID
    };
  }
}

module.exports = Monster;

},{"../public/gameConfig.json":13,"../public/util.js":18}],6:[function(require,module,exports){
function CObstacle(posX, posY, radius, id, resourceData){
  this.objectID = id;

  this.imgData = resourceData;

  this.position = {
    x : posX, y : posY
  };
  // user when draw obstacle
  // this.localPosition = {
  //   x : posX, y : posY
  // };

  this.size = {
    width : radius * 2, height : radius * 2
  };
  this.center = {
    x : this.position.x + this.size.width/2,
    y : this.position.y + this.size.height/2
  }

  // this.setSize(radius * 2, radius * 2);
  // this.setPosition(posX, posY);

  this.staticEle = {
    x : this.position.x,
    y : this.position.y,
    width : this.size.width,
    height : this.size.height,
    id : this.objectID,

    isCollide : false
  };
};

CObstacle.prototype = {
  setPosition : function(x, y){
    this.position.x = x;
    this.position.y = y;
    this.setCenter();
  },
  setSize : function(w, h){
    this.size.width = w;
    this.size.height = h;
  },
  setCenter : function(){
    if(this.size.width == 0 || this.size.height == 0){
      console.error('setSize before setCenter');
    }
    this.center.x = this.position.x + this.size.width/2;
    this.center.y = this.position.y + this.size.height/2;
  },
  setTreeImgEle : function(treeImgRadius){
    this.treeImgEle = {
      x : this.center.x - treeImgRadius,
      y : this.center.y - treeImgRadius,
      width : treeImgRadius * 2,
      height : treeImgRadius * 2,
      id : this.objectID,

      isCollide : false
    }
  }
};
module.exports = CObstacle;

},{}],7:[function(require,module,exports){
var util = require('../public/util.js');
var gameConfig = require('../public/gameConfig.json');

function CSkill(skillData, userAniStartTime){
  // this.startTime = Date.now();

  this.index = skillData.index;
  this.type = skillData.type;
  this.property = skillData.property;

  this.consumeMP = skillData.consumeMP;
  this.totalTime = skillData.totalTime;
  this.fireTime = skillData.fireTime;
  this.range = skillData.range;
  this.explosionRadius = skillData.explosionRadius;

  this.radius = skillData.radius;
  this.maxSpeed = skillData.maxSpeed;
  this.lifeTime = skillData.lifeTime;

  this.direction = skillData.direction;
  this.targetPosition = skillData.targetPosition;

  this.userAniStartTime = userAniStartTime;
  this.effectLastTime = skillData.effectLastTime;

  this.repeatCount = skillData.repeatCount;
  this.repeatDelay = skillData.repeatDelay;

  this.effect = {
    position : this.targetPosition,
    radius : this.explosionRadius,
    startTime : 0,
    lifeTime  : this.effectLastTime
  };

  this.userAniTimeout = false;
  this.fireTimeout = false;
  this.totalTimeout = false;

  this.onUserAniStart = new Function();
  this.onFire = new Function();
  this.onTimeOver = new Function();
};

CSkill.prototype = {
  executeSkill : function(){
    this.userAniTimeout = setTimeout(userAniTimeoutHandler.bind(this), this.userAniStartTime);

    var skillInformTime = this.fireTime - gameConfig.SKILL_INFORM_TIME;
    if(skillInformTime < 0){
      skillInformTime = 0;
    }
    if(this.userAniStartTime > skillInformTime){
      skillInformTime = this.userAniStartTime;
    }
    this.syncFireTime = Date.now() + this.fireTime; // for synchronize
    this.fireTimeout = setTimeout(fireTimeoutHandler.bind(this), skillInformTime);
    this.totalTimeout = setTimeout(totalTimeoutHandler.bind(this), this.totalTime);
  },
  startEffectTimer : function(){
    this.effect.startTime = Date.now();
  },
  destroy : function(){
    if(this.userAniTimeout){
      clearTimeout(this.userAniTimeout);
    }
    if(this.fireTimeout){
      clearTimeout(this.fireTimeout);
    }
    if(this.totalTimeout){
      clearTimeout(this.totalTimeout);
    }
  },
  makeProjectile : function(userCenter, projectileID, direction){
    var forePosition = util.calcForePosition(userCenter, this.radius, direction, gameConfig.PROJECTILE_FIRE_DISTANCE);
    var projectile = new ProjectileSkill(this, forePosition, projectileID, direction)
    return projectile;
  }
};
function userAniTimeoutHandler(){
  this.onUserAniStart();
};
function fireTimeoutHandler(){
  this.onFire(this.syncFireTime);

  // var thisOnFire = this.onFire();
  if(this.repeatCount){
    for(var i=0; i<this.repeatCount; i++){
      (function repeatFire(x, repeatDelay, syncFireTime, thisOnFire){
        var timeDelay = (x + 1) * repeatDelay;
        var syncTime = syncFireTime + timeDelay;
        setTimeout(function(){
          thisOnFire(syncTime);
        }, timeDelay);
      })(i, this.repeatDelay, this.syncFireTime, this.onFire);
    }
  }
};
function totalTimeoutHandler(){
  this.onTimeOver();
};

var ProjectileSkill = function(skillInstance, currentPosition, ID, direction){
  this.objectID = ID;

  this.index = skillInstance.index;
  this.position = {
    x : currentPosition.x,
    y : currentPosition.y
  };
  this.direction = direction;
  this.speed = {
    x : skillInstance.maxSpeed * Math.cos(this.direction * Math.PI/180),
    y : skillInstance.maxSpeed * Math.sin(this.direction * Math.PI/180)
  };
  // this.timer = Date.now();
  this.radius = skillInstance.radius;
  this.lifeTime = skillInstance.lifeTime;
  this.explosionRadius = skillInstance.explosionRadius;
};


module.exports = CSkill;

},{"../public/gameConfig.json":13,"../public/util.js":18}],8:[function(require,module,exports){
var util = require('../public/util.js');
var gameConfig = require('../public/gameConfig.json');
var objectAssign = require('../public/objectAssign.js');
var serverList = require('../public/serverList.json');
var youtuberList = require('../public/youtuberList.json');

var dataJson = require('../public/data.json');
var csvJson = require('../public/csvjson.js');
var csvJsonOption = {delimiter : ',', quote : '"'};

var skillTable = csvJson.toObject(dataJson.skillData, csvJsonOption);
var buffGroupTable = csvJson.toObject(dataJson.buffGroupData, csvJsonOption);
var iconResourceTable = csvJson.toObject(dataJson.iconResourceData, csvJsonOption);
var userStatTable = csvJson.toObject(dataJson.userStatData, csvJsonOption);
// var skillTable, buffGroupTable, iconResourceTable, userStatTable;
var resourceUI;

var blankFrameData;

var startScene, gameScene, standingScene;
var startButton, restartButton;

// var startSceneHudCenterCenterChar1, startSceneHudCenterCenterChar2, startSceneHudCenterCenterChar3;
var characterType = 1;

var fireCharName = "PYRO";
var fireCharDesc = "<span class='red'>PYRO</span> is a powerful mage.<br><span class='red'>PYRO</span> is more powerful when PYRO`s HP is lower.<br><span class='memo'>Check Passive Spell</span>";
var frostCharName = "FROSTER";
var frostCharDesc = "<span class='blue'>FROSTER</span> is a magical mage.<br><span class='blue'>FROSTER</span>`s ice spell may freeze enemy.<br><span class='memo'>Check Passive Spell</span>";
var arcaneCharName = "MYSTER";
var arcaneCharDesc = "<span class='purple'>MYSTER</span> is a unpredictable mage.<br><span class='purple'>MYSTER</span> will be strengthen whenever use arcane spell.<br><span class='memo'>Check Passive Spell</span>";

var baseSkill = 0;
var baseSkillData = null;
var inherentPassiveSkill = 0;
var inherentPassiveSkillData = null;
var equipSkills = new Array(4);
var equipSkillDatas = new Array(4);
var possessSkills = [];
var newSkills = [], beforeGameNewSkills = []; //[21,41,31,51,61,71,81,1011,1021,1031,1041,1051,1061,1071,1081,2011,2021,2031,2041,2061,2071,2081];
var conditions = [], userMP = 0;;
conditions[gameConfig.USER_CONDITION_FREEZE] = false; conditions[gameConfig.USER_CONDITION_SILENCE] = false;
conditions[gameConfig.USER_CONDITION_BLUR] = false;

var statPower = 0, statMagic = 0, statSpeed = 0;
var cooldownReduceRate = 0;

var loadingTextDotCount = 1, reconnectTextDotCount = 1, reconnectTextTimeout = false;
var hudBaseSkillImg, hudEquipSkill1Img, hudEquipSkill2Img, hudEquipSkill3Img, hudEquipSkill4Img, hudPassiveSkillImg;
var hudBtnSkillChange;
var gameSceneBuffsContainer;
var userHPProgressBar, userMPProgressBar, userExpProgressBar;

var isBaseSkillCooldownOff = true, isEquipSkill1CooldownOff = true, isEquipSkill2CooldownOff = true, isEquipSkill3CooldownOff = true, isEquipSkill4CooldownOff = true;
var cooldownSkills = [], standbyEquipPassiveList = [];
var hudBaseSkillMask, hudEquipSkill1Mask, hudEquipSkill2Mask, hudEquipSkill3Mask, hudEquipSkill4Mask;
var hudBaseSkillBlockMask, hudEquipSkill1BlockMask, hudEquipSkill2BlockMask, hudEquipSkill3BlockMask, hudEquipSkill4BlockMask, hudPassiveSkillBlockMask;
var hudBaseSkillConditionBlockMask, hudEquipSkill1ConditionBlockMask, hudEquipSkill2ConditionBlockMask, hudEquipSkill3ConditionBlockMask, hudEquipSkill4ConditionBlockMask;
var gameSceneHudBottomRightCenter, gameSceneCharNameAndLevel, userStatOffence, userStatDefence, userStatPowerContainer, userStatMagicContainer, userStatSpeedContainer;
var gameSceneHudTopLeft, gameSceneHudTopCenter, selectSkillIcon, selectSkillInfo, btnSelectSkillCancel;
var goldContainer, jewelContainer, goldContainer2, jewelContainer2, gameBoardRank, gameBoardName, gameBoardLevel, gameBoardKillScore, gameBoardTotalKillCount, gameBoardTotalScore;
var gameSceneDeadScene, deadSceneBackground; //, deadSceneTextContainer, deadSceneText; //, deadSceneToLevel, deadSceneLoseGold, deadSceneLoseJewel;
var chatInputContainer, chatInput;

var flashMessageContainer, risingMessageContainer, adminMessageContainer, downMessageContainer, reconnectScene, reconnectMessage;
var serverDownTimeout = false;
var beforeRisingMessageTime = Date.now(), beforeFlaseMessageTime = Date.now();
// var killBoardDisableTimeout = false;

var isClearTutorial = false, isPlayingTutorial = false;

var popUpSkillChange, popUpCloseBtn, popUpSkillContainer, popUpBackground, popUpSetting, resetKeySettings, keySettings;
var originKeySettings = {
  "BindingE" : 69,
  "BindingSpace" : 32,
  "BindingA" : 65,
  "Binding1" : 49,
  "Binding2" : 50,
  "Binding3" : 51,
  "Binding4" : 52,
  "BindingS" : 83,
  "BindingG" : 71,
  // "BindingHome" : 36,
  "BindingEnter" : 13,
  "BindingEsc" : 27
};
var popUpSkillInfoAndBtn, popUpSkillInfoIcon, popUpSkillInfoDesc, skillUpgradeEffect, popUpSkillUpgradeCostGold, popUpSkillUpgradeCostJewel, popUpSkillUpgradeBtn, popUpCancelSkillSelectBtn;
var popUpSkillTutorialClickText1, popUpSkillTutorialClickText2, popUpSkillTutorialArrow, popUpSkillTextSkillInfo;
var popUpEquipBaseSkill, popUpEquipSkillsContainer, popUpEquipSkill1, popUpEquipSkill2, popUpEquipSkill3, popUpEquipSkill4, popUpEquipPassiveSkill, popUpSortType, popUpSortBtn;

var standingSceneSelectedCharName, standingSceneSelectedCharStatPower, standingSceneSelectedCharStatMagic, standingSceneSelectedCharStatSpeed,
    standingSceneSelectedCharBaseSkill, standingSceneSelectedCharPassiveSkill, standingSceneSelectedCharEquipSkill1, standingSceneSelectedCharEquipSkill2, standingSceneSelectedCharEquipSkill3, standingSceneSelectedCharEquipSkill4,
    standingSceneSkillSettingBtn, userStandingNickName;

var miniMapUser, miniMapChest1, miniMapChest2; //, miniMapChest3, miniMapChest4, miniMapChest5, miniMapChest6, miniMapChest7, miniMapChest8, miniMapChest9;
var gameSceneFpsText, gameScenePingText;
// var feedbackBtn;

var selectedPanel = null;
var selectedDiv = null;
var selectedEquipIndex = null;
var selectedSkillIndex = null;

var isServerResponse = true;

// ad
var displayAdContainer, displayAdRefresh, displayContainer, videoAdPlay, videoAdComplete = true;

function UIManager(){
  // skillTable = sTable;
  // buffGroupTable = bTable;
  // iconResourceTable = iTable;
  // userStatTable = usTable;

  this.serverResponseTimeout = false;

  this.onLoadCompleteServerList = new Function();
  this.onStartBtnClick = new Function();
  // this.onSocialBtnClick = new Function();
  this.serverConditionOn = new Function();
  this.serverConditionOff = new Function();

  this.updateKillCount = new Function();
  this.onSetRankers = new Function();
  this.onPopUpSkillChangeClick = new Function();
  this.onSelectCharIcon = new Function();
  this.onSelectSkillCancelBtnClick = new Function();
  this.onSkillIconClick = new Function();
  this.onSkillUpgrade = new Function();
  this.onExchangeSkill = new Function();
  this.onExchangePassive = new Function();
  this.onEquipPassive = new Function();
  this.onUnequipPassive = new Function();

  this.onUpgradeCharSkills = new Function();
  this.onDeadSceneConfirmClick = new Function();
};
UIManager.prototype = {
  initStartScene : function(){
    startScene = document.getElementById('startScene');
    gameScene = document.getElementById('gameScene');
    standingScene = document.getElementById('standingScene');

    startButton = document.getElementById('startButton');

    var startSceneSelectedCharName = document.getElementById('startSceneSelectedCharName');
    var startSceneSelectedCharStatPower = document.getElementById('startSceneSelectedCharStatPower');
    var startSceneSelectedCharStatMagic = document.getElementById('startSceneSelectedCharStatMagic');
    var startSceneSelectedCharStatSpeed = document.getElementById('startSceneSelectedCharStatSpeed');
    var startSceneSelectedCharDesc = document.getElementById('startSceneSelectedCharDesc');

    //init standing scene variables
    restartButton = document.getElementById('restartButton');
    standingSceneSelectedCharName = document.getElementById('standingSceneSelectedCharName');
    standingSceneSelectedCharStatPower = document.getElementById('standingSceneSelectedCharStatPower');
    standingSceneSelectedCharStatMagic = document.getElementById('standingSceneSelectedCharStatMagic');
    standingSceneSelectedCharStatSpeed = document.getElementById('standingSceneSelectedCharStatSpeed');
    standingSceneSelectedCharBaseSkill = document.getElementById('standingSceneSelectedCharBaseSkill');
    standingSceneSelectedCharPassiveSkill = document.getElementById('standingSceneSelectedCharPassiveSkill');
    standingSceneSelectedCharEquipSkill1 = document.getElementById('standingSceneSelectedCharEquipSkill1');
    standingSceneSelectedCharEquipSkill2 = document.getElementById('standingSceneSelectedCharEquipSkill2');
    standingSceneSelectedCharEquipSkill3 = document.getElementById('standingSceneSelectedCharEquipSkill3');
    standingSceneSelectedCharEquipSkill4 = document.getElementById('standingSceneSelectedCharEquipSkill4');
    standingSceneSelectedCharBaseSkill.getElementsByTagName('img')[0].src = resourceUI;
    standingSceneSelectedCharPassiveSkill.getElementsByTagName('img')[0].src = resourceUI;
    standingSceneSelectedCharEquipSkill1.getElementsByTagName('img')[0].src = resourceUI;
    standingSceneSelectedCharEquipSkill2.getElementsByTagName('img')[0].src = resourceUI;
    standingSceneSelectedCharEquipSkill3.getElementsByTagName('img')[0].src = resourceUI;
    standingSceneSelectedCharEquipSkill4.getElementsByTagName('img')[0].src = resourceUI;

    standingSceneSelectedCharBaseSkill.onmouseover = skillTooltipHandler.bind(standingSceneSelectedCharBaseSkill);
    standingSceneSelectedCharBaseSkill.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharBaseSkill);
    standingSceneSelectedCharPassiveSkill.onmouseover = skillTooltipHandler.bind(standingSceneSelectedCharPassiveSkill);
    standingSceneSelectedCharPassiveSkill.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharPassiveSkill);
    standingSceneSelectedCharEquipSkill1.onmouseover = skillTooltipHandler.bind(standingSceneSelectedCharEquipSkill1);
    standingSceneSelectedCharEquipSkill1.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharEquipSkill1);
    standingSceneSelectedCharEquipSkill2.onmouseover = skillTooltipHandler.bind(standingSceneSelectedCharEquipSkill2);
    standingSceneSelectedCharEquipSkill2.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharEquipSkill2);
    standingSceneSelectedCharEquipSkill3.onmouseover = skillTooltipHandler.bind(standingSceneSelectedCharEquipSkill3);
    standingSceneSelectedCharEquipSkill3.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharEquipSkill3);
    standingSceneSelectedCharEquipSkill4.onmouseover = skillTooltipHandler.bind(standingSceneSelectedCharEquipSkill4);
    standingSceneSelectedCharEquipSkill4.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharEquipSkill4);

    standingSceneSkillSettingBtn = document.getElementById('standingSceneSkillSettingBtn');
    userStandingNickName = document.getElementById('userStandingNickName');

    // startButton.addEventListener('click', startBtnClickHandler.bind(this, startButton), false);
    startButton.onclick = startBtnClickHandler.bind(this, startButton);
    startButton.getElementsByTagName('span')[0].classList.remove('disable');
    startButton.getElementsByTagName('img')[0].classList.add('disable');

    setStartNickName();
    // setStartSceneCharIconClick();

    // // set social btns
    // var startSceneFacebook = document.getElementById('startSceneFacebook');
    // var startSceneTwitter = document.getElementById('startSceneTwitter');
    // var standingSceneFacebook = document.getElementById('standingSceneFacebook');
    // var standingSceneTwitter = document.getElementById('standingSceneTwitter');
    //
    // // var thisOnSocialBtnClick = this.onSocialBtnClick;
    // function socialBtnHandler(path){
    //   var req = util.createRequest();
    //   req.onreadystatechange = function(e){
    //     if(req.readyState === 4){
    //       var twitter = util.getCookie(document.cookie, 'twitter');
    //       var facebook = util.getCookie(document.cookie, 'facebook');
    //       thisOnSocialBtnClick(twitter, facebook);
    //     }
    //   }
    //   req.open('POST', path, true);
    //   req.send();
    // }
    // startSceneFacebook.onclick = socialBtnHandler.bind('', '/facebook');
    // standingSceneFacebook.onclick = socialBtnHandler.bind('', '/facebook');
    // startSceneTwitter.onclick = socialBtnHandler.bind('', '/twitter');
    // standingSceneTwitter.onclick = socialBtnHandler.bind('', '/twitter');

    // refreshUtuber();

    displayContainer = document.getElementById('displayContainer');
    displayAdContainer = document.getElementById('displayAdContainer');
    displayAdRefresh = document.getElementById('displayAdRefresh');
    videoAdPlay = document.getElementById('videoAdPlay');

    // set Login buttons
    var signInGoogle1 = document.getElementById('signInGoogle1');
    var signInGoogle2 = document.getElementById('signInGoogle2');
    var playGoogle = document.getElementById('playGoogle');
    var playAsGuest = document.getElementById('playAsGuest');
    var optionLogout = document.getElementById('optionLogout');

    signInGoogle1.onclick = function() {
      window.open('/auth/google', 'newwindow', 'width=630, height=630');
      return false;
    }
    signInGoogle2.onclick = function() {
      window.open('/auth/google', 'newwindow', 'width=630, height=630');
      return false;
    }
    playGoogle.onclick = function() {
      window.open('/auth/google', 'newwindow', 'width=630, height=630');
      return false;
    }
    playAsGuest.onclick = function() {
      var req = util.createRequest();
      req.onreadystatechange = function(e){
        if(req.readyState === 4){
          if(req.status === 200){
            // window.onbeforeunload = null;
            window.location.href = '/';
          }
        }
      }
      req.open('POST', '/playAsGuest', true);
      req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      req.send('username=guest&password=null');
      return false;
    }
    optionLogout.onclick = function() {
      if (!_a) {
        if (confirm('Account is not registered.\nLogout will result in loss all data!\nDo you want to logout?')) {
          // logout
          // window.onbeforeunload = null;
          window.location.href='/logout';
          return false;
        }
      } else {
        // logout
        // window.onbeforeunload = null;
        window.location.href='/logout';
        return false;
      }
    }
    // document.getElementById('deadSceneConfirm').onclick = this.onDeadSceneConfirmClick;
  },
  setStartSceneLevels: function(pyro, froster, myster) {
    var children = document.getElementById('startSceneHudCenterCenterCharSelect').children;
    children[0].getElementsByTagName('span')[0].innerText = 'Lv. ' + pyro;
    children[1].getElementsByTagName('span')[0].innerText = 'Lv. ' + froster;
    children[2].getElementsByTagName('span')[0].innerText = 'Lv. ' + myster;
    setStartSceneCharIconClick(pyro, froster, myster);
  },
  // completeTwitter : function(){
  //   var startSceneTwitterReward = document.getElementById('startSceneTwitterReward');
  //   var standingSceneTwitterReward = document.getElementById('standingSceneTwitterReward');
  //   startSceneTwitterReward.getElementsByTagName('img')[1].classList.remove('disable');
  //   standingSceneTwitterReward.getElementsByTagName('img')[1].classList.remove('disable');
  // },
  // completeFacebook : function(){
  //   var startSceneFacebookReward = document.getElementById('startSceneFacebookReward');
  //   var standingSceneFacebookReward = document.getElementById('standingSceneFacebookReward');
  //   startSceneFacebookReward.getElementsByTagName('img')[1].classList.remove('disable');
  //   standingSceneFacebookReward.getElementsByTagName('img')[1].classList.remove('disable');
  // },
  setServerList : function(){
    var servers = document.getElementById('servers');
    var isFindAvailableServer = false;
    var isFirstResponse = false;
    var thisOnLoadCompleteServerList = this.onLoadCompleteServerList;

    setTimeout(function(){
      if(!isFindAvailableServer){
        alert('Sorry. Can`t find available server.')
        servers.selectedIndex = 1;
        isFindAvailableServer = true;
        thisOnLoadCompleteServerList();
      }
    }, gameConfig.MAX_FIND_AVAILABLE_SERVER_TIME);

    var optionIndex = 0;
    for(var index in serverList){
      if(!serverList[index]){
        util.createDomSelectOptGroup(index, servers, false);
      }else{
        var ip = 'http://' + serverList[index].IP;
        var parentNode = servers.querySelectorAll('[label="' + serverList[index].SERVER + '"]')[0];
        util.createDomSelectOption(index, ip, true, parentNode);
        try {
          (function tryAjax(){
            var req = util.createRequest();
            req.onreadystatechange = function(e){
              if(req.readyState === 4){
                if(req.status === 200){
                  var res = JSON.parse(req.response);
                  if(!res.isServerDown){
                    var DOMOption = servers.querySelectorAll('[value="' + res.ip + '"]')[0];
                    DOMOption.disabled = false;
                    if(parseInt(res.currentUser) >= parseInt(res.maxUser)){
                      DOMOption.classList.add('overUser');
                    }
                    if(Date.now() - res.startTime >= gameConfig.MAX_PING_LIMIT){
                      DOMOption.classList.add('highPing');
                    }
                    if(!DOMOption.classList.contains('overUser') && !DOMOption.classList.contains('highPing')){
                      DOMOption.classList.add('available');
                    }
                    var text = DOMOption.text + ' [' + res.currentUser + '/' + res.maxUser + '] ' + (Date.now() - res.startTime) + 'ms';
                    DOMOption.text = text;
                    if(!isFirstResponse){
                      //select default
                      isFirstResponse = true;
                      servers.selectedIndex = res.optionIndex;
                    }
                    if(!isFindAvailableServer){
                      if(parseInt(res.currentUser) < parseInt(res.maxUser)){
                        isFindAvailableServer = true;
                        thisOnLoadCompleteServerList();
                        servers.selectedIndex = res.optionIndex;
                      }
                    }
                  }else{
                    var DOMOption = servers.querySelectorAll('[value="' + res.ip + '"]')[0];
                    var text = DOMOption.text + ' [' + res.currentUser + '/' + res.maxUser + ']';
                    DOMOption.text = text;
                  }
                }
              }
            }
            req.open('POST', ip + '/usersInfo', true);
            req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            // var data = JSON.stringify({'ip' : ip});
            // req.send({ip : ip});
            req.send('ip=' + ip + '&startTime=' + Date.now() + '&optionIndex=' + optionIndex);
          })();
          optionIndex++;
        } catch (e) {
          console.warn(e.message);
          console.warn(ip + ' in not response');
        }
      }
    }
  },
  getSelectedServer : function(){
    var servers = document.getElementById('servers');
    return servers.options[servers.selectedIndex].value;
  },
  getStartUserName : function(){
    var userStartNickName = document.getElementById('userStartNickName').value;
    if(userStartNickName){
      var name = util.processMessage(userStartNickName, gameConfig.USER_NICK_NAME_LENGTH, true);
      if (name) {
        name = util.checkName(characterType, name);
      }
      if(name){
        return name;
      }else{
        return util.setRandomName(characterType);
      }
    }else{
      return util.setRandomName(characterType);
    }
  },
  getStandingUserName : function(){
    // var userStandingNickName = document.getElementById('userStandingNickName').value;
    var nickName = userStandingNickName.value;
    if(nickName){
      var name = util.processMessage(nickName, gameConfig.USER_NICK_NAME_LENGTH, true);
      if (name) {
        name = util.checkName(characterType, name);
      }
      if(name){
        return name;
      }else{
        return util.setRandomName(characterType);
      }
    }else{
      return util.setRandomName(characterType);
    }
  },
  checkServerCondition : function(url){
    var req = util.createRequest();
    var startTime = Date.now();
    var thisServerConditionOn = this.serverConditionOn;
    var thisServerConditionOff = this.serverConditionOff;

    req.onreadystatechange = function(e){
      if(req.readyState === 4){
        if(req.status === 200){
          var res = JSON.parse(req.response);
          var ping = Date.now() - startTime;
          if(res.canJoin){
            if(ping < gameConfig.MAX_PING_LIMIT){
              thisServerConditionOn();
            }else{
              alert('Ping is too high! How about join to other server.');
              thisServerConditionOff();
            }
          }else{
            if(res.version !== gameConfig.GAME_VERSION){
              alert('Client`s game version is different from server`s. Reload page.');
              location.reload();
            }else if(res.isServerDown){
              alert('Server is down for update! Reload page.');
              location.reload();
            }else{
              alert('The server is currently full! How about join to other server.');
            }
            thisServerConditionOff();
          }
        }else{
          alert('Sorry. Unpredicted internet server error!');
          thisServerConditionOff();
        }
      }
    }

    try {
      startTime = Date.now();
      req.open('POST', url + '/serverCheck', true);
      req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      // req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      req.send('version=' + gameConfig.GAME_VERSION);
    } catch (e) {
      console.warn(e.message);
      console.warn(url + ' is not response');
    }
  },
  // setFeedbackBtn : function(){
  //   try {
  //     feedbackBtn = document.getElementById('crowd-shortcut').parentNode;
  //   } catch (e) {
  //     console.warn(e.message);
  //   }
  // },
  disableStartButton : function(){
    startButton.onclick = '';
    startButton.getElementsByTagName('span')[0].classList.add('disable');
    startButton.getElementsByTagName('img')[0].classList.remove('disable');

    //char icon disable
    var children = document.getElementById('startSceneHudCenterCenterCharSelect').children;
    for(var i=0; i<children.length; i++){
      children[i].onclick = new Function();
    }
  },
  enableStartButton : function(){
    startButton.onclick = startBtnClickHandler.bind(this, startButton);
    startButton.getElementsByTagName('span')[0].classList.remove('disable');
    startButton.getElementsByTagName('img')[0].classList.add('disable');

    // setStartSceneCharIconClick();
  },
  disableStartScene : function(){
    // startScene.classList.add('disable');
    startScene.classList.add('disappearSmoothAni');
    startScene.classList.remove('enable');
    setTimeout(function(){
      startScene.classList.add('disable');
    }, 1000);
    // startScene.addEventListener('animationend', function(){
    //   startScene.classList.add('disable');
    // }, false);
    gameScene.classList.add('appearSmoothAni');
    gameScene.classList.remove('disable');
    setTimeout(function(){
      gameScene.classList.add('enable');
      gameScene.classList.remove('appearSmoothAni');
    }, 1000);

    displayAdContainer.classList.add('disable');
    // startButton.removeEventListener('click', startBtnClickHandler);

    startVideoAdTimer(10 * 60 * 1000);
    //set video ad play
    adEventHandler = function(){
      videoAdComplete = true
      startVideoAdTimer(5 * 60 * 1000);
    }
    if(!popUpSetting.classList.contains('disable')){
      popChange(popUpSetting);
      //save keySetting Cookie
      util.setCookie('keySettings', JSON.stringify(keySettings));
    }
  },
  initStandingScene : function(charType, userName){
    // standingScene.classList.add('appearSmoothAni');
    // refreshUtuber();

    displayAdRefresh.onclick();
    displayAdContainer.classList.remove('disable');

    standingScene.classList.remove('disable');
    standingScene.classList.add('enable');
    setTimeout(function(){
      // standingScene.classList.add('enable');
      // standingScene.classList.remove('appearSmoothAni');
      restartButton.getElementsByTagName('span')[0].classList.remove('disable');
      restartButton.getElementsByTagName('img')[0].classList.add('disable');
    }, 1500);

    userStandingNickName.select();
    userStandingNickName.onkeydown = function(e){
      if(e.keyCode ===13 || e.which === 13){
        restartButton.onclick();
      }
    }

    userStandingNickName.value = userName;

    var index = 0;
    switch (charType) {
      case gameConfig.CHAR_TYPE_FIRE:
        index = 0;
        break;
      case gameConfig.CHAR_TYPE_FROST:
        index = 1;
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        index = 2;
        break;
      default:
    }
    // restartButton.addEventListener('click', startBtnClickHandler.bind(this, restartButton), false);
    restartButton.onclick = startBtnClickHandler.bind(this, restartButton);
    var restartBtnSpan = restartButton.getElementsByTagName('span')[0];
    if(!videoAdComplete){
      restartBtnSpan.innerHTML = 'Join Game <span class="small">(Ad)</span>';
    }else{
      restartBtnSpan.innerHTML = 'Join Game';
    }
    // restartButton.getElementsByTagName('span')[0].classList.remove('disable');
    // restartButton.getElementsByTagName('img')[0].classList.add('disable');

    var thisCharSelectEvent = this.onSelectCharIcon;

    var children = document.getElementById('standingSceneHudCenterCenterCharSelect').children;
    for(var i=0; i<children.length; i++){
      if(index === i){
        for(var j=0; j<children.length; j++){
          children[j].classList.remove('selectedChar');
        }
        children[i].classList.add('selectedChar');
      }

      children[i].onclick = function(){
        var type = parseInt(this.getAttribute('type'));
        if(type === gameConfig.CHAR_TYPE_FIRE || type === gameConfig.CHAR_TYPE_FROST || type === gameConfig.CHAR_TYPE_ARCANE){
          characterType = type;
          for(var j=0; j<children.length; j++){
            children[j].classList.remove('selectedChar');
          }
          this.classList.add('selectedChar');

          // updateCharInfoSelectedPanel(type);
          thisCharSelectEvent(type);
        }else{
          //if type data is changed by user, always click fire
          thisCharSelectEvent(gameConfig.CHAR_TYPE_FIRE);
        }
      };
    }
    children[index].onclick();

    standingSceneSkillSettingBtn.onclick = function(){
      clearSelectedPanel();

      popChange(popUpSkillChange, true);
      popUpSortBtn.onclick();

      if(!isClearTutorial){
        playPopUpTutorial();
      }else{
        disablePopUpTutorial();
      }
    }
  },
  updateCharInfoSelectedPanel : function(type, level){
    var name = "";
    var color = "white";
    switch (type) {
      case gameConfig.CHAR_TYPE_FIRE:
        name = fireCharName;
        color = "red";
        break;
      case gameConfig.CHAR_TYPE_FROST:
        name = frostCharName;
        color = "blue";
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        name = arcaneCharName;
        color = "purple";
        break;
      default:
    }
    var statData = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', type, 'level', level));
    standingSceneSelectedCharName.innerHTML = "<span class='yellow'>Lv " + level + " </span><span class='" + color + "'>" + name + "</span>";

    standingSceneSelectedCharStatPower.getElementsByTagName('span')[0].innerHTML = statData.power;
    standingSceneSelectedCharStatMagic.getElementsByTagName('span')[0].innerHTML = statData.magic;
    standingSceneSelectedCharStatSpeed.getElementsByTagName('span')[0].innerHTML = statData.speed;

    standingSceneSelectedCharStatPower.onmouseover = statTooltipOnHandler.bind(standingSceneSelectedCharStatPower, gameConfig.STAT_POWER_INDEX, statData.power);
    standingSceneSelectedCharStatPower.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharStatPower);

    standingSceneSelectedCharStatMagic.onmouseover = statTooltipOnHandler.bind(standingSceneSelectedCharStatMagic, gameConfig.STAT_MAGIC_INDEX, statData.magic);
    standingSceneSelectedCharStatMagic.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharStatMagic);

    standingSceneSelectedCharStatSpeed.onmouseover = statTooltipOnHandler.bind(standingSceneSelectedCharStatSpeed, gameConfig.STAT_SPEED_INDEX, statData.speed);
    standingSceneSelectedCharStatSpeed.onmouseout = bottomTooltipOffHandler.bind(standingSceneSelectedCharStatSpeed);

    updateCharInfoSelectedPanelSkillImage();
  },
  disableStandingScene : function(){
    displayAdContainer.classList.add('disable');
    //char icon selet event disable
    var children = document.getElementById('standingSceneHudCenterCenterCharSelect').children;
    for(var i=0; i<children.length; i++){
      children[i].onclick = '';
    }

    standingScene.classList.add('disappearSmoothAni');
    standingScene.classList.remove('enable');
    setTimeout(function(){
      standingScene.classList.add('disable');
      standingScene.classList.remove('disappearSmoothAni');
    }, 1000);
    // standingScene.addEventListener('animationend', function(){
    //   standingScene.classList.add('disable');
    // }, false);
    gameScene.classList.add('appearSmoothAni');
    gameScene.classList.remove('disable');
    setTimeout(function(){
      gameScene.classList.add('enable');
      gameScene.classList.remove('appearSmoothAni');
    }, 1000);
    // gameScene.classList.add('enable');
    // gameScene.classList.remove('disable');

    // restartButton.removeEventListener('click', startBtnClickHandler);
    this.disableRestartButton();
    if(!popUpSetting.classList.contains('disable')){
      popChange(popUpSetting);
      //save keySetting Cookie
      util.setCookie('keySettings', JSON.stringify(keySettings));
    }
  },
  disableFieldUIs : function() {
    document.getElementById('hudResourceUI').classList.add('disable');
    hudBtnSkillChange.parentNode.classList.add('disable');
  },
  enableFieldUIs : function() {
    document.getElementById('hudResourceUI').classList.remove('disable');
    hudBtnSkillChange.parentNode.classList.remove('disable');
  },
  disableRestartButton : function(){
    restartButton.onclick = '';
    restartButton.getElementsByTagName('span')[0].classList.add('disable');
    restartButton.getElementsByTagName('img')[0].classList.remove('disable');
    standingSceneSkillSettingBtn.onclick = '';
  },
  initHUD : function(keySetting){
    hudBaseSkillImg = document.getElementById('hudBaseSkillImg');
    hudEquipSkill1Img = document.getElementById('hudEquipSkill1Img');
    hudEquipSkill2Img = document.getElementById('hudEquipSkill2Img');
    hudEquipSkill3Img = document.getElementById('hudEquipSkill3Img');
    hudEquipSkill4Img = document.getElementById('hudEquipSkill4Img');
    hudPassiveSkillImg = document.getElementById('hudPassiveSkillImg');

    hudBaseSkillImg.src = resourceUI;
    hudEquipSkill1Img.src = resourceUI;
    hudEquipSkill2Img.src = resourceUI;
    hudEquipSkill3Img.src = resourceUI;
    hudEquipSkill4Img.src = resourceUI;
    hudPassiveSkillImg.src = resourceUI;

    hudBaseSkillImg.addEventListener('mouseover', bottomSkillTooltipOnHandler.bind(hudBaseSkillImg, gameConfig.SKILL_BASIC_INDEX), false);
    hudEquipSkill1Img.addEventListener('mouseover', bottomSkillTooltipOnHandler.bind(hudEquipSkill1Img, gameConfig.SKILL_EQUIP1_INDEX), false);
    hudEquipSkill2Img.addEventListener('mouseover', bottomSkillTooltipOnHandler.bind(hudEquipSkill2Img, gameConfig.SKILL_EQUIP2_INDEX), false);
    hudEquipSkill3Img.addEventListener('mouseover', bottomSkillTooltipOnHandler.bind(hudEquipSkill3Img, gameConfig.SKILL_EQUIP3_INDEX), false);
    hudEquipSkill4Img.addEventListener('mouseover', bottomSkillTooltipOnHandler.bind(hudEquipSkill4Img, gameConfig.SKILL_EQUIP4_INDEX), false);
    hudPassiveSkillImg.addEventListener('mouseover', bottomSkillTooltipOnHandler.bind(hudPassiveSkillImg, gameConfig.SKILL_PASSIVE_INDEX), false);

    hudBaseSkillImg.addEventListener('mouseout', bottomSkillTooltipOffHandler.bind(hudBaseSkillImg), false);
    hudEquipSkill1Img.addEventListener('mouseout', bottomSkillTooltipOffHandler.bind(hudEquipSkill1Img), false);
    hudEquipSkill2Img.addEventListener('mouseout', bottomSkillTooltipOffHandler.bind(hudEquipSkill2Img), false);
    hudEquipSkill3Img.addEventListener('mouseout', bottomSkillTooltipOffHandler.bind(hudEquipSkill3Img), false);
    hudEquipSkill4Img.addEventListener('mouseout', bottomSkillTooltipOffHandler.bind(hudEquipSkill4Img), false);
    hudPassiveSkillImg.addEventListener('mouseout', bottomSkillTooltipOffHandler.bind(hudPassiveSkillImg), false);

    hudBaseSkillImg.onclick = onSkillIconClickHandler.bind(this, gameConfig.SKILL_BASIC_INDEX);
    hudEquipSkill1Img.onclick = onSkillIconClickHandler.bind(this, gameConfig.SKILL_EQUIP1_INDEX);
    hudEquipSkill2Img.onclick = onSkillIconClickHandler.bind(this, gameConfig.SKILL_EQUIP2_INDEX);
    hudEquipSkill3Img.onclick = onSkillIconClickHandler.bind(this, gameConfig.SKILL_EQUIP3_INDEX);
    hudEquipSkill4Img.onclick = onSkillIconClickHandler.bind(this, gameConfig.SKILL_EQUIP4_INDEX);

    hudBtnSkillChange = document.getElementById('hudBtnSkillChange');

    gameSceneBuffsContainer = document.getElementById('gameSceneBuffsContainer');
    userHPProgressBar = document.getElementById('userHPProgressBar');
    userExpProgressBar = document.getElementById('userExpProgressBar');
    userMPProgressBar = document.getElementById('userMPProgressBar');

    hudBaseSkillMask = document.getElementById('hudBaseSkillMask');
    hudEquipSkill1Mask = document.getElementById('hudEquipSkill1Mask');
    hudEquipSkill2Mask = document.getElementById('hudEquipSkill2Mask');
    hudEquipSkill3Mask = document.getElementById('hudEquipSkill3Mask');
    hudEquipSkill4Mask = document.getElementById('hudEquipSkill4Mask');

    hudBaseSkillMask.addEventListener('animationend', cooldownListener.bind(hudBaseSkillMask, gameConfig.SKILL_BASIC_INDEX, this.checkSkillsConditions), false);
    hudEquipSkill1Mask.addEventListener('animationend', cooldownListener.bind(hudEquipSkill1Mask, gameConfig.SKILL_EQUIP1_INDEX, this.checkSkillsConditions), false);
    hudEquipSkill2Mask.addEventListener('animationend', cooldownListener.bind(hudEquipSkill2Mask, gameConfig.SKILL_EQUIP2_INDEX, this.checkSkillsConditions), false);
    hudEquipSkill3Mask.addEventListener('animationend', cooldownListener.bind(hudEquipSkill3Mask, gameConfig.SKILL_EQUIP3_INDEX, this.checkSkillsConditions), false);
    hudEquipSkill4Mask.addEventListener('animationend', cooldownListener.bind(hudEquipSkill4Mask, gameConfig.SKILL_EQUIP4_INDEX, this.checkSkillsConditions), false);

    hudBaseSkillBlockMask = document.getElementById('hudBaseSkillBlockMask');
    hudEquipSkill1BlockMask = document.getElementById('hudEquipSkill1BlockMask');
    hudEquipSkill2BlockMask = document.getElementById('hudEquipSkill2BlockMask');
    hudEquipSkill3BlockMask = document.getElementById('hudEquipSkill3BlockMask');
    hudEquipSkill4BlockMask = document.getElementById('hudEquipSkill4BlockMask');
    hudPassiveSkillBlockMask = document.getElementById('hudPassiveSkillBlockMask');

    hudBaseSkillConditionBlockMask = document.getElementById('hudBaseSkillConditionBlockMask');
    hudEquipSkill1ConditionBlockMask = document.getElementById('hudEquipSkill1ConditionBlockMask');
    hudEquipSkill2ConditionBlockMask = document.getElementById('hudEquipSkill2ConditionBlockMask');
    hudEquipSkill3ConditionBlockMask = document.getElementById('hudEquipSkill3ConditionBlockMask');
    hudEquipSkill4ConditionBlockMask = document.getElementById('hudEquipSkill4ConditionBlockMask');

    gameSceneHudBottomRightCenter = document.getElementById('gameSceneHudBottomRightCenter');
    gameSceneCharNameAndLevel = document.getElementById('gameSceneCharNameAndLevel');
    userStatOffence = document.getElementById('userStatOffence');
    userStatDefence = document.getElementById('userStatDefence');

    userStatPowerContainer = document.getElementById('userStatPowerContainer');
    userStatMagicContainer = document.getElementById('userStatMagicContainer');
    userStatSpeedContainer = document.getElementById('userStatSpeedContainer');

    miniMapUser = document.getElementById('miniMapUser');
    miniMapChest1 = document.getElementById('miniMapChest1');
    miniMapChest2 = document.getElementById('miniMapChest2');
    // miniMapChest3 = document.getElementById('miniMapChest3');
    // miniMapChest4 = document.getElementById('miniMapChest4');
    // miniMapChest5 = document.getElementById('miniMapChest5');
    // miniMapChest6 = document.getElementById('miniMapChest6');
    // miniMapChest7 = document.getElementById('miniMapChest7');
    // miniMapChest8 = document.getElementById('miniMapChest8');
    // miniMapChest9 = document.getElementById('miniMapChest9');

    gameSceneFpsText = document.getElementById('gameSceneFpsText');
    gameScenePingText = document.getElementById('gameScenePingText');

    gameSceneHudTopLeft = document.getElementById('gameSceneHudTopLeft');
    gameSceneHudTopCenter = document.getElementById('gameSceneHudTopCenter');
    selectSkillImgContainer = document.getElementById('selectSkillImgContainer');
    // selectSkillIcon = document.getElementById('selectSkillIcon');
    // selectSkillIcon.src = resourceUI;
    selectSkillInfo = document.getElementById('selectSkillInfo');
    btnSelectSkillCancel = document.getElementById('btnSelectSkillCancel');
    btnSelectSkillCancel.onclick = onSelectSkillCancelBtnClickHandler.bind(this);
    goldContainer = document.getElementById('goldContainer');
    jewelContainer = document.getElementById('jewelContainer');
    goldContainer2 = document.getElementById('goldContainer2');
    jewelContainer2 = document.getElementById('jewelContainer2');
    gameBoardRank = document.getElementById('gameBoardRank');
    gameBoardName = document.getElementById('gameBoardName');
    gameBoardLevel = document.getElementById('gameBoardLevel');
    gameBoardKillScore = document.getElementById('gameBoardKillScore');
    gameBoardTotalKillCount = document.getElementById('gameBoardTotalKillCount');
    gameBoardTotalScore = document.getElementById('gameBoardTotalScore');

    gameSceneDeadScene = document.getElementById('gameSceneDeadScene');
    deadSceneBackground = document.getElementById('deadSceneBackground');
    // deadSceneTextContainer = document.getElementById('deadSceneTextContainer');
    // deadSceneText = document.getElementById('deadSceneText');
    // deadSceneToLevel = document.getElementById('deadSceneToLevel');
    // deadSceneLoseGold = document.getElementById('deadSceneLoseGold');
    // deadSceneLoseJewel = document.getElementById('deadSceneLoseJewel');

    chatInputContainer = document.getElementById('chatInputContainer');
    chatInput = document.getElementById('chatInput');

    flashMessageContainer = document.getElementById('flashMessageContainer');
    risingMessageContainer = document.getElementById('risingMessageContainer');
    downMessageContainer = document.getElementById('downMessageContainer');
    reconnectScene = document.getElementById('reconnectScene');
    reconnectMessage = document.getElementById('reconnectMessage');
    adminMessageContainer = document.getElementById('adminMessageContainer');

    popUpSetting = document.getElementById('popUpSetting');
    resetKeySettings = document.getElementById('resetKeySettings');
    resetKeySettings.onclick = this.resetKeySettings.bind(this);

    var settingButton1 = document.getElementById('settingButton1');
    var settingButton2 = document.getElementById('settingButton2');
    settingButton1.onclick = function(){
      popChange(popUpSetting, false);
      //save keySetting Cookie
      util.setCookie('keySettings', JSON.stringify(keySettings));
    };
    settingButton2.onclick = function(){
      popChange(popUpSetting, false);
      //save keySetting Cookie
      util.setCookie('keySettings', JSON.stringify(keySettings));
    };
    keySettings = keySetting;

    var bindE = document.getElementById('bindE');
    var bindSpace = document.getElementById('bindSpace');
    var bindA = document.getElementById('bindA');
    var bind1 = document.getElementById('bind1');
    var bind2 = document.getElementById('bind2');
    var bind3 = document.getElementById('bind3');
    var bind4 = document.getElementById('bind4');
    var bindS = document.getElementById('bindS');
    var bindG = document.getElementById('bindG');
    // var bindHome = document.getElementById('bindHome');

    bindE.oninput = keyBindHandler.bind(this, bindE, 'BindingE');
    bindSpace.oninput = keyBindHandler.bind(this, bindSpace, 'BindingSpace');
    bindA.oninput = keyBindHandler.bind(this, bindA, 'BindingA');
    bind1.oninput = keyBindHandler.bind(this, bind1, 'Binding1');
    bind2.oninput = keyBindHandler.bind(this, bind2, 'Binding2');
    bind3.oninput = keyBindHandler.bind(this, bind3, 'Binding3');
    bind4.oninput = keyBindHandler.bind(this, bind4, 'Binding4');
    bindS.oninput = keyBindHandler.bind(this, bindS, 'BindingS');
    bindG.oninput = keyBindHandler.bind(this, bindG, 'BindingG');
    // bindHome.oninput = keyBindHandler.bind(this, bindHome, 'BindingHome');
  },
  changeLoadingText : function(){
    var loadingText = document.getElementById('loadingText');
    var output = "Loading ";
    switch (loadingTextDotCount) {
      case 1:
        output += ".";
        break;
      case 2:
        output += "..";
        break;
      case 3:
        output += "...";
        break;
    }
    loadingTextDotCount ++;
    if(loadingTextDotCount > 3){
      loadingTextDotCount = 1;
    }
    loadingText.innerHTML = output;
  },
  startSceneLoadingComplete : function(){
    var loadingImgContainer = document.getElementById('loadingImgContainer');
    var startSceneHudContent = document.getElementById('startSceneHudContent');

    loadingImgContainer.getElementsByTagName('span')[0].classList.add('disable');
    loadingImgContainer.classList.add('disappearSmoothAni');
    setTimeout(function(){
      loadingImgContainer.classList.remove('disappearSmoothAni');
      loadingImgContainer.classList.add('disable');
    }, 1000);
        startSceneHudContent.classList.remove('disable');
    startSceneHudContent.classList.add('appearSmoothAni');
    setTimeout(function(){
      startSceneHudContent.classList.remove('appearSmoothAni');
    }, 1000);

    var userStartNickName = document.getElementById('userStartNickName');
    userStartNickName.select();
    userStartNickName.onkeydown = function(e){
      if(e.keyCode ===13 || e.which === 13){
        startButton.onclick();
      }
    }
    if (_u) {
      this.startSceneLoginComplete();
    }
  },
  startSceneLoginComplete: function() {
    var loginContainer = document.getElementById('loginContainer');
    var charSelectContainer = document.getElementById('charSelectContainer');

    loginContainer.classList.add('disable');
    charSelectContainer.classList.remove('disable');

    var startSceneLogin = document.getElementById('startSceneLogin');
    var standingSceneLogin = document.getElementById('standingSceneLogin');
    startSceneLogin.classList.remove('disable');
    standingSceneLogin.classList.remove('disable');

    if (_a) {
      //change login to logout
      startSceneLogin.getElementsByTagName('h3')[0].innerText = 'Logout';
      standingSceneLogin.getElementsByTagName('h3')[0].innerText = 'Logout';

      var signInGoogle1 = document.getElementById('signInGoogle1');
      var signInGoogle2 = document.getElementById('signInGoogle2');
      signInGoogle1.classList.remove('btn-google');
      signInGoogle2.classList.remove('btn-google');
      signInGoogle1.classList.add('btn-disable');
      signInGoogle2.classList.add('btn-disable');
      signInGoogle1.innerHTML = 'Log out';
      signInGoogle2.innerHTML = 'Log out';
      signInGoogle1.onclick = function() {
        // window.onbeforeunload = null;
        window.location.href='/logout';
        return false;
      }
      signInGoogle2.onclick = function() {
        // window.onbeforeunload = null;
        window.location.href='/logout';
        return false;
      }
    }

    document.getElementById('optionLogout').classList.remove('disable');
  },
  drawStartScene : function(){
    // var loadingImgContainer = document.getElementById('loadingImgContainer');
    // var startSceneHudContent = document.getElementById('startSceneHudContent');
    // startSceneHudContent.classList.remove('disable');
    // startScene.classList.add('enable');
    // startScene.classList.remove('disable');
    gameScene.classList.add('disable');
    // gameScene.classList.remove('enable');
    standingScene.classList.add('disable');
    // standingScene.classList.remove('enable');
  },
  drawGameScene : function(){
    startScene.classList.add('disable');
    standingScene.classList.add('disable');
  },
  drawRestartScene : function(){
    startScene.classList.add('disable');
    gameScene.classList.add('disable');
  },
  drawFPSAndPing : function(fps, ping){
    if(fps < 40){
      if(fps < 0){
        fps = 0;
      }
      gameSceneFpsText.innerHTML = 'FPS : <span class="red">' + fps + '</span>';
    }else{
      gameSceneFpsText.innerHTML = 'FPS : <span class="green">' + fps + '</span>';
    }
    if(ping > 500){
      gameScenePingText.innerHTML = 'PING : <span class="red">' + ping + 'ms</span>';
    }else{
      gameScenePingText.innerHTML = 'PING : <span class="green">' + ping + 'ms</span>';
    }
  },
  enableSelectSkillInfo : function(skillData){
    // selectSkillIcon.src = skillData.skillIcon;
    var img = document.createElement('img');
    var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
    img.src = resourceUI;
    var rate = 1;
    img.style.clip = util.makeCssClipStyle(iconData, rate);
    util.setImgCssStyle(img, iconData, rate);
    selectSkillImgContainer.appendChild(img);
    // selectSkillIcon.style.clip = util.makeCssClipStyle(iconData);
    // util.setImgCssStyle(selectSkillIcon, iconData);
    var color = 'white';
    switch (skillData.property) {
      case gameConfig.SKILL_PROPERTY_FIRE:
        color = 'red'
        break;
      case gameConfig.SKILL_PROPERTY_FROST:
        color = 'blue'
        break;
      case gameConfig.SKILL_PROPERTY_ARCANE:
        color = 'purple'
        break;
      default:
    }
    selectSkillInfo.getElementsByTagName('h4')[0].innerHTML = "<span class='yellow'>Lv " + skillData.level + " </span><span class='" + color + "'>" + skillData.clientName + "</span>";
    selectSkillInfo.getElementsByTagName('div')[0].innerHTML = "<span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + (skillData.fireDamage + skillData.frostDamage + skillData.arcaneDamage) + "</span>";
    selectSkillInfo.getElementsByTagName('div')[1].innerHTML = "<span class='yellow'>ManaCost : </span>" + (skillData.consumeMP);
    selectSkillInfo.getElementsByTagName('div')[2].innerHTML = skillData.clientDesc.replace(/&nbsp;/g, '<br>');;

    gameSceneHudTopCenter.classList.add('enable');
    gameSceneHudTopCenter.classList.remove('disable');

    switch (skillData.index) {
      case baseSkill:
        hudEquipSkill1BlockMask.classList.remove('disable');
        hudEquipSkill2BlockMask.classList.remove('disable');
        hudEquipSkill3BlockMask.classList.remove('disable');
        hudEquipSkill4BlockMask.classList.remove('disable');
        hudPassiveSkillBlockMask.classList.remove('disable');
        break;
      case equipSkills[0]:
        hudBaseSkillBlockMask.classList.remove('disable');
        hudEquipSkill2BlockMask.classList.remove('disable');
        hudEquipSkill3BlockMask.classList.remove('disable');
        hudEquipSkill4BlockMask.classList.remove('disable');
        hudPassiveSkillBlockMask.classList.remove('disable');
        break;
      case equipSkills[1]:
        hudBaseSkillBlockMask.classList.remove('disable');
        hudEquipSkill1BlockMask.classList.remove('disable');
        hudEquipSkill3BlockMask.classList.remove('disable');
        hudEquipSkill4BlockMask.classList.remove('disable');
        hudPassiveSkillBlockMask.classList.remove('disable');
        break;
      case equipSkills[2]:
        hudBaseSkillBlockMask.classList.remove('disable');
        hudEquipSkill1BlockMask.classList.remove('disable');
        hudEquipSkill2BlockMask.classList.remove('disable');
        hudEquipSkill4BlockMask.classList.remove('disable');
        hudPassiveSkillBlockMask.classList.remove('disable');
        break;
      case equipSkills[3]:
        hudBaseSkillBlockMask.classList.remove('disable');
        hudEquipSkill1BlockMask.classList.remove('disable');
        hudEquipSkill2BlockMask.classList.remove('disable');
        hudEquipSkill3BlockMask.classList.remove('disable');
        hudPassiveSkillBlockMask.classList.remove('disable');
        break;
      default:
    }
  },
  disableSelectSkillInfo : function(){
    // selectSkillIcon.src = "";
    while (selectSkillImgContainer.firstChild) {
      selectSkillImgContainer.removeChild(selectSkillImgContainer.firstChild);
    }
    selectSkillInfo.getElementsByTagName('h4')[0].innerHTML = "";

    gameSceneHudTopCenter.classList.add('disable');
    gameSceneHudTopCenter.classList.remove('enable');

    hudBaseSkillBlockMask.classList.add('disable');
    hudEquipSkill1BlockMask.classList.add('disable');
    hudEquipSkill2BlockMask.classList.add('disable');
    hudEquipSkill3BlockMask.classList.add('disable');
    hudEquipSkill4BlockMask.classList.add('disable');
    hudPassiveSkillBlockMask.classList.add('disable');
  },
  syncSkills : function(bSkill, bSkillData, eSkills, eSkillDatas, pSkills, iSkill, iSkillData){
    baseSkill = bSkill;
    baseSkillData = bSkillData;
    equipSkills = eSkills;
    equipSkillDatas = eSkillDatas;
    possessSkills = pSkills;
    inherentPassiveSkill = iSkill;
    inherentPassiveSkillData = iSkillData;
  },
  updatePossessionSkills : function(pSkills){
    possessSkills = pSkills;
  },
  setNewSkill : function(skillIndex){
    newSkills.push(skillIndex);
  },
  updateNewSkills : function(nSkills){
    for (var i=0; i<nSkills.length; i++) {
      // if(!newSkills.includes(nSkills[i])){
      if(newSkills.indexOf(nSkills[i]) === -1){
        newSkills.push(nSkills[i]);
        beforeGameNewSkills.push(nSkills[i]);
      }
    }
    var imgTags = hudBtnSkillChange.parentNode.getElementsByTagName('img');
    imgTags[0].classList.add('disable');
    var standingSceneImgTags = standingSceneSkillSettingBtn.getElementsByTagName('img');
    standingSceneImgTags[0].classList.add('disable');
    if (newSkills.length) {
      imgTags[0].classList.remove('disable');
      standingSceneImgTags[0].classList.remove('disable');
    }
  },
  updateHP : function(userData){
    var percent = userData.HP/userData.mHP * 100;
    if(percent > 100){
      percent = 100;
    }
    userHPProgressBar.style.height = percent + "%";
    var textDiv = userHPProgressBar.parentNode.getElementsByTagName('div')[1];
    textDiv.innerHTML = Math.floor(userData.HP) + "<br>/ " + Math.floor(userData.mHP);
  },
  updateMP : function(userData){
    userMP = userData.MP;
    var percent = userData.MP/userData.mMP * 100;
    if(percent > 100){
      percent = 100;
    }
    userMPProgressBar.style.height = percent + "%";
    var textDiv = userMPProgressBar.parentNode.getElementsByTagName('div')[1];
    textDiv.innerHTML = Math.floor(userData.MP) + "<br>/ " + Math.floor(userData.mMP);
  },
  updateExp : function(userData, needExp){
    if(needExp === -1){
      var percent = 100;
    }else{
      percent = userData.ep / needExp * 100;
      if(percent > 100){
        percent = 100;
      }
    }
    userExpProgressBar.style.width = percent + "%";
  },
  updateCondition : function(userConditions){
    conditions[gameConfig.USER_CONDITION_FREEZE] = userConditions[gameConfig.USER_CONDITION_FREEZE];
    conditions[gameConfig.USER_CONDITION_SILENCE] = userConditions[gameConfig.USER_CONDITION_SILENCE];
    conditions[gameConfig.USER_CONDITION_BLUR] = userConditions[gameConfig.USER_CONDITION_BLUR];
  },
  checkSkillsConditions : function(){
    var allSkillDisable = false;
    var baseSkillDisable = false, equipSkill1Disable = false, equipSkill2Disable = false, equipSkill3Disable = false, equipSkill4Disable = false;

    if(conditions[gameConfig.USER_CONDITION_FREEZE] || conditions[gameConfig.USER_CONDITION_SILENCE] || conditions[gameConfig.USER_CONDITION_BLUR]){
      allSkillDisable = true;
    }else{
      //check mana and cooldown
      if(!isBaseSkillCooldownOff){
        baseSkillDisable = true;
      }
      if(equipSkillDatas[0]){
        if(equipSkillDatas[0].consumeMP > userMP){
          equipSkill1Disable = true;
        }else if(!isEquipSkill1CooldownOff){
          equipSkill1Disable = true;
        }else if(equipSkillDatas[0].type === gameConfig.SKILL_TYPE_PASSIVE){
          equipSkill1Disable = true;
        }
      }
      if(equipSkillDatas[1]){
        if(equipSkillDatas[1].consumeMP > userMP){
          equipSkill2Disable = true;
        }else if(!isEquipSkill2CooldownOff){
          equipSkill2Disable = true;
        }else if(equipSkillDatas[1].type === gameConfig.SKILL_TYPE_PASSIVE){
          equipSkill2Disable = true;
        }
      }
      if(equipSkillDatas[2]){
        if(equipSkillDatas[2].consumeMP > userMP){
          equipSkill3Disable = true;
        }else if(!isEquipSkill3CooldownOff){
          equipSkill3Disable = true;
        }else if(equipSkillDatas[2].type === gameConfig.SKILL_TYPE_PASSIVE){
          equipSkill3Disable = true;
        }
      }
      if(equipSkillDatas[3]){
        if(equipSkillDatas[3].consumeMP > userMP){
          equipSkill4Disable = true;
        }else if(!isEquipSkill4CooldownOff){
          equipSkill4Disable = true;
        }else if(equipSkillDatas[3].type === gameConfig.SKILL_TYPE_PASSIVE){
          equipSkill4Disable = true;
        }
      }
    }
    if(allSkillDisable){
      hudBaseSkillConditionBlockMask.classList.remove('disable');
      hudEquipSkill1ConditionBlockMask.classList.remove('disable');
      hudEquipSkill2ConditionBlockMask.classList.remove('disable');
      hudEquipSkill3ConditionBlockMask.classList.remove('disable');
      hudEquipSkill4ConditionBlockMask.classList.remove('disable');
    }else{
      hudBaseSkillConditionBlockMask.classList.add('disable');
      hudEquipSkill1ConditionBlockMask.classList.add('disable');
      hudEquipSkill2ConditionBlockMask.classList.add('disable');
      hudEquipSkill3ConditionBlockMask.classList.add('disable');
      hudEquipSkill4ConditionBlockMask.classList.add('disable');
      if(baseSkillDisable){
        hudBaseSkillConditionBlockMask.classList.remove('disable');
      }
      if(equipSkill1Disable){
        hudEquipSkill1ConditionBlockMask.classList.remove('disable');
      }
      if(equipSkill2Disable){
        hudEquipSkill2ConditionBlockMask.classList.remove('disable');
      }
      if(equipSkill3Disable){
        hudEquipSkill3ConditionBlockMask.classList.remove('disable');
      }
      if(equipSkill4Disable){
        hudEquipSkill4ConditionBlockMask.classList.remove('disable');
      }
    }
  },
  applySkill : function(skillIndex, remainCooldown){
    //check skill slot
    var slotMask = null;
    var cooldownData = {};
    if(baseSkill === skillIndex){
      slotMask = hudBaseSkillMask;
      isBaseSkillCooldownOff = false;
      cooldownData.slot = gameConfig.SKILL_BASIC_INDEX;
    }else if(equipSkills[0] === skillIndex){
      slotMask = hudEquipSkill1Mask;
      isEquipSkill1CooldownOff = false;
      cooldownData.slot = gameConfig.SKILL_EQUIP1_INDEX;
    }else if(equipSkills[1] === skillIndex){
      slotMask = hudEquipSkill2Mask;
      isEquipSkill2CooldownOff = false;
      cooldownData.slot = gameConfig.SKILL_EQUIP2_INDEX;
    }else if(equipSkills[2] === skillIndex){
      slotMask = hudEquipSkill3Mask;
      isEquipSkill3CooldownOff = false;
      cooldownData.slot = gameConfig.SKILL_EQUIP3_INDEX;
    }else if(equipSkills[3] === skillIndex){
      slotMask = hudEquipSkill4Mask;
      isEquipSkill4CooldownOff = false;
      cooldownData.slot = gameConfig.SKILL_EQUIP4_INDEX;
    }else{
      console.warn('can not find skill slot');
    }
    //cooldown start
    if(slotMask){
      var skillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));
      if(remainCooldown){
        var cooldown = remainCooldown / 1000;
      }else{
        cooldown = skillData.cooldown * (100 - cooldownReduceRate) / 100000;
        cooldownData.skillIndex = skillData.index;
        cooldownData.startTime = Date.now();
        cooldownData.cooldownTime = cooldown;
        cooldownSkills.push(cooldownData);
      }
      slotMask.style.animationDuration = (cooldown) + 's';
      slotMask.classList.add("cooldownMaskAni");
    }
  },
  applySkillCooldown : function(skillIndex, equipIndex){
    var slot = convertEquipIndexToEnum(equipIndex);
    var slotCooldown = 0;
    for(var i=0; i<cooldownSkills.length; i++){
      if(cooldownSkills[i].slot === slot){
        var delayTime = Date.now() - cooldownSkills[i].startTime;
        slotCooldown = cooldownSkills[i].cooldownTime * 1000 - delayTime;
      }
    }
    for(var i=0; i<cooldownSkills.length; i++){
      if(cooldownSkills[i].skillIndex === skillIndex){
        var delayTime = Date.now() - cooldownSkills[i].startTime;
        var skillCooldown = cooldownSkills[i].cooldownTime * 1000 - delayTime;
        if(skillCooldown > slotCooldown){
          if(skillCooldown >= 500){
            this.applySkill(skillIndex, skillCooldown);
          }
        }
      }
    }
  },
  updateUnEquipSkillSlotCooldown : function(equipIndex){
    //convert equipIndex to enum skill slot index
    var slot = convertEquipIndexToEnum(equipIndex);
    var needClear = true;
    for(var i=0; i<cooldownSkills.length; i++){
      if(cooldownSkills[i].slot === slot){
        needClear = false;
      }
    }
    if(needClear){
      switch (slot) {
        case gameConfig.SKILL_EQUIP1_INDEX:
          isEquipSkill1CooldownOff = true;
          hudEquipSkill1Mask.classList.remove("cooldownMaskAni");
          hudEquipSkill1Mask.style.opacity = 0;
          break;
        case gameConfig.SKILL_EQUIP2_INDEX:
          isEquipSkill2CooldownOff = true;
          hudEquipSkill2Mask.classList.remove("cooldownMaskAni");
          hudEquipSkill2Mask.style.opacity = 0;
          break;
        case gameConfig.SKILL_EQUIP3_INDEX:
          isEquipSkill3CooldownOff = true;
          hudEquipSkill3Mask.classList.remove("cooldownMaskAni");
          hudEquipSkill3Mask.style.opacity = 0;
          break;
        case gameConfig.SKILL_EQUIP4_INDEX:
          isEquipSkill4CooldownOff = true;
          hudEquipSkill4Mask.classList.remove("cooldownMaskAni");
          hudEquipSkill4Mask.style.opacity = 0;
          break;
        default:
      }
      this.checkSkillsConditions();
    }
  },
  checkCooltime : function(skillIndex){
    switch (skillIndex) {
      case baseSkill:
        return true;
        // return isBaseSkillCooldownOff;
      case equipSkills[0]:
        return isEquipSkill1CooldownOff;
      case equipSkills[1]:
        return isEquipSkill2CooldownOff;
      case equipSkills[2]:
        return isEquipSkill3CooldownOff;
      case equipSkills[3]:
        return isEquipSkill4CooldownOff;
      default:
    }
  },
  clearCooltime : function(){
    isEquipSkill1CooldownOff = true;
    hudEquipSkill1Mask.classList.remove("cooldownMaskAni");
    hudEquipSkill1Mask.style.opacity = 0;

    isEquipSkill2CooldownOff = true;
    hudEquipSkill2Mask.classList.remove("cooldownMaskAni");
    hudEquipSkill2Mask.style.opacity = 0;

    isEquipSkill3CooldownOff = true;
    hudEquipSkill3Mask.classList.remove("cooldownMaskAni");
    hudEquipSkill3Mask.style.opacity = 0;

    isEquipSkill4CooldownOff = true;
    hudEquipSkill4Mask.classList.remove("cooldownMaskAni");
    hudEquipSkill4Mask.style.opacity = 0;
  },
  setHUDSkills : function(){
    var rate = 48 / 72;
    if(baseSkillData){
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', baseSkillData.skillIcon));
      hudBaseSkillImg.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(hudBaseSkillImg, iconData, rate);
    }else{
      hudBaseSkillImg.style.clip = util.makeCssClipStyle(blankFrameData, rate);
      util.setImgCssStyle(hudBaseSkillImg, blankFrameData, rate);
    }
    if(inherentPassiveSkillData){
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', inherentPassiveSkillData.skillIcon));
      hudPassiveSkillImg.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(hudPassiveSkillImg, iconData, rate);
    }else{
      hudPassiveSkillImg.style.clip = util.makeCssClipStyle(blankFrameData, rate);
      util.setImgCssStyle(hudPassiveSkillImg, blankFrameData, rate);
    }
    rate = 64 / 72;
    if(equipSkillDatas[0]){
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[0].skillIcon));
      hudEquipSkill1Img.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(hudEquipSkill1Img, iconData, rate);
    }else{
      hudEquipSkill1Img.style.clip = util.makeCssClipStyle(blankFrameData, rate);
      util.setImgCssStyle(hudEquipSkill1Img, blankFrameData, rate);
    }
    if(equipSkillDatas[1]){
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[1].skillIcon));
      hudEquipSkill2Img.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(hudEquipSkill2Img, iconData, rate);
    }else{
      hudEquipSkill2Img.style.clip = util.makeCssClipStyle(blankFrameData, rate);
      util.setImgCssStyle(hudEquipSkill2Img, blankFrameData, rate);
    }
    if(equipSkillDatas[2]){
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[2].skillIcon));
      hudEquipSkill3Img.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(hudEquipSkill3Img, iconData, rate);
    }else{
      hudEquipSkill3Img.style.clip = util.makeCssClipStyle(blankFrameData, rate);
      util.setImgCssStyle(hudEquipSkill3Img, blankFrameData, rate);
    }
    if(equipSkillDatas[3]){
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[3].skillIcon));
      hudEquipSkill4Img.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(hudEquipSkill4Img, iconData, rate);
    }else{
      hudEquipSkill4Img.style.clip = util.makeCssClipStyle(blankFrameData, rate);
      util.setImgCssStyle(hudEquipSkill4Img, blankFrameData, rate);
    }
  },
  setHUDStats : function(data){
    var color = 'white'
    switch (characterType) {
      case gameConfig.CHAR_TYPE_FIRE:
        var charName = fireCharName;
        color = 'red';
        break;
      case gameConfig.CHAR_TYPE_FROST:
        charName = frostCharName;
        color = 'blue';
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        charName = arcaneCharName;
        color = "purple";
        break;
      default:
    }

    if(data.lv === 20){
      gameSceneCharNameAndLevel.innerHTML = "<span class='yellow'>Lv MAX</span><span class='" + color + "'>" + charName + "</span>";
    }else{
      gameSceneCharNameAndLevel.innerHTML = "<span class='yellow'>Lv " + data.lv + "</span><span class='" + color + "'>" + charName + "</span>";
    }

    var offenceRate = Math.floor((data.dR + (data.fiDR + data.frDR + data.acDR) / 3 - 200) * 10) / 10;
    var defenceRate = Math.floor((data.rA + (data.rFi + data.rFr + data.rAc) / 3)* 10) / 10;

    userStatOffence.getElementsByTagName('span')[0].innerHTML = offenceRate + " %";
    userStatOffence.onmouseover = offenceDefenceStatOnHandler.bind(userStatOffence, gameConfig.STAT_OFFENCE_INDEX, data);
    userStatOffence.onmouseout = bottomTooltipOffHandler.bind(userStatOffence);
    userStatDefence.getElementsByTagName('span')[0].innerHTML = defenceRate + " %";
    userStatDefence.onmouseover = offenceDefenceStatOnHandler.bind(userStatDefence, gameConfig.STAT_DEFENCE_INDEX, data);
    userStatDefence.onmouseout = bottomTooltipOffHandler.bind(userStatDefence);

    userStatPowerContainer.getElementsByTagName('span')[0].innerHTML = statPower = data.sP;
    userStatPowerContainer.onmouseover = statTooltipOnHandler.bind(userStatPowerContainer, gameConfig.STAT_POWER_INDEX, statPower);
    userStatPowerContainer.onmouseout = bottomTooltipOffHandler.bind(userStatPowerContainer);
    userStatMagicContainer.getElementsByTagName('span')[0].innerHTML = statMagic = data.sM;
    userStatMagicContainer.onmouseover = statTooltipOnHandler.bind(userStatMagicContainer, gameConfig.STAT_MAGIC_INDEX, statMagic);
    userStatMagicContainer.onmouseout = bottomTooltipOffHandler.bind(userStatMagicContainer);
    userStatSpeedContainer.getElementsByTagName('span')[0].innerHTML = statSpeed = data.sS;
    userStatSpeedContainer.onmouseover = statTooltipOnHandler.bind(userStatSpeedContainer, gameConfig.STAT_SPEED_INDEX, statSpeed);
    userStatSpeedContainer.onmouseout = bottomTooltipOffHandler.bind(userStatSpeedContainer);
  },
  setCooldownReduceRate : function(reduceRate){
    cooldownReduceRate = reduceRate;
  },
  setSkillChangeBtn : function(){
    hudBtnSkillChange.onclick = function(){
      clearSelectedPanel();
      popChange(popUpSkillChange);
      popUpSortBtn.onclick();
      if(!isClearTutorial){
        playPopUpTutorial();
      }else{
        disablePopUpTutorial();
      }
    }
    popUpCloseBtn.onclick = function(){
      clearSelectedPanel();
      popChange(popUpSkillChange);
      popUpSortBtn.onclick();
    }

    popUpBackground.onclick = function(){
      clearSelectedPanel();
      popChange(popUpSkillChange);
      popUpSortBtn.onclick();
    }
  },
  popChangeWithKey : function(){
    clearSelectedPanel();
    popChange(popUpSkillChange);
    popUpSortBtn.onclick();
    hudBtnSkillChange.classList.add('clicked');
    setTimeout(function(){
      hudBtnSkillChange.classList.remove('clicked');
    }, 250);
  },
  popCloseWithKey : function(){
    if(!popUpSkillChange.classList.contains('disable')){
      this.closePopUpSkillChange();
      hudBtnSkillChange.classList.add('clicked');

      setTimeout(function(){
        hudBtnSkillChange.classList.remove('clicked');
      }, 250);
    }
  },
  setSkillIconResource : function(resource){
    resourceUI = resource.src;

    blankFrameData = objectAssign({}, util.findData(iconResourceTable, 'index', gameConfig.UI_RESOURCE_INDEX_BLANK));
  },
  setResource : function(resourceData){
    goldContainer.innerHTML = resourceData.g;
    jewelContainer.innerHTML = resourceData.j;
    goldContainer2.innerHTML = resourceData.g;
    jewelContainer2.innerHTML = resourceData.j;
  },
  getResource : function(){
    var goldAmount = parseInt(goldContainer.innerText);
    var jewelAmount = parseInt(jewelContainer.innerText);
    return {
      gold : goldAmount,
      jewel : jewelAmount
    }
  },
  addResource : function(gold, jewel){
    var goldAmount = parseInt(goldContainer.innerText);
    var jewelAmount = parseInt(jewelContainer.innerText);
    if(util.isNumeric(gold) && util.isNumeric(goldAmount)){
      goldContainer.innerText = goldAmount + gold;
      goldContainer2.innerText = goldAmount + gold;
    }
    if(util.isNumeric(jewel) && util.isNumeric(jewelAmount)){
      jewelContainer.innerText = jewelAmount + jewel;
      jewelContainer2.innerText = jewelAmount + jewel;
    }
  },
  makeAdminMessage : function(msg){
    var message = document.createElement('p');
    message.innerHTML = msg;
    message.classList.add('adminMessage');
    adminMessageContainer.appendChild(message);
    setTimeout(function(){
      message.classList.add('adminMessageAni');
    }, 2000);
    setTimeout(function(){
      adminMessageContainer.removeChild(message);
    }, 7000);
  },
  makeDownMessage : function(msg, time){
    downMessageContainer.innerHTML = '';
    var message = document.createElement('p');
    var newTime = parseInt(time / (60 * 1000));
    message.innerHTML = msg + ' (' + newTime + ' min)';
    message.classList.add('downMessage');
    downMessageContainer.appendChild(message);
    var that = this;
    serverDownTimeout = setTimeout(function(){
      time -= 60 * 1000;
      that.makeDownMessage.call(that, msg, time);
    }, 60 * 1000);
  },
  cancelDown : function(){
    downMessageContainer.innerHTML = '';
    if(serverDownTimeout){
      clearTimeout(serverDownTimeout);
    }
    serverDownTimeout = false;
  },
  makeFlashMessage : function(msg){
    if(Date.now() - beforeFlaseMessageTime > 650){
      beforeFlaseMessageTime = Date.now();
      var message = document.createElement('p');
      message.innerHTML = msg;
      message.classList.add('flashMessage');
      flashMessageContainer.appendChild(message);
      setTimeout(function(){
        message.classList.add('flashMessageAni');
      }, 2000);
      setTimeout(function(){
        flashMessageContainer.removeChild(message);
      }, 5000);
    }
  },
  makeRisingMessage : function(addResource){
    var delayTime = 0;
    if(Date.now() > beforeRisingMessageTime + 150){
      delayTime = 0;
      beforeRisingMessageTime = Date.now();
    }else{
      delayTime = beforeRisingMessageTime + 150 - Date.now();
      beforeRisingMessageTime = Date.now() + delayTime;
    }

    setTimeout(function(){
      var div = document.createElement('div');
      div.classList.add('risingMessage');
      // if(addResource.type === gameConfig.GET_RESOURCE_TYPE_EXP){
      //   var text = "<span class='yellow'>EXP + </span>" + addResource.amount;
      //   div.innerHTML = text;
      // }else
      if(addResource.type === gameConfig.GET_RESOURCE_TYPE_GOLD){
        var img = document.createElement('img');
        img.src = "../images/GoldIcon.png";
        div.appendChild(img);
        var span = document.createElement('span');
        span.innerHTML = "<span class='yellow'> + </span>" + addResource.amount;
        div.appendChild(span);
      }else if(addResource.type === gameConfig.GET_RESOURCE_TYPE_JEWEL){
        var img = document.createElement('img');
        img.src = "../images/JewelIcon.png";
        div.appendChild(img);
        var span = document.createElement('span');
        span.innerHTML = "<span class='yellow'> + </span>" + addResource.amount;
        div.appendChild(span);
      }
      risingMessageContainer.appendChild(div);
      setTimeout(function(){
        div.classList.add('risingMessageAni');
      }, 50);
      setTimeout(function(){
        risingMessageContainer.removeChild(div);
      }, 3000);
    }, delayTime);
  },
  makeRisingMessageForSkill : function(skillData, isChangeToResource){
    var delayTime = 0;
    if(Date.now() > beforeRisingMessageTime + 150){
      delayTime = 0;
      beforeRisingMessageTime = Date.now();
    }else{
      delayTime = beforeRisingMessageTime + 150 - Date.now();
      beforeRisingMessageTime = Date.now() + delayTime;
    }
    setTimeout(function(){
      var div = document.createElement('div');
      div.classList.add('risingMessageSkill');

      var imgContainer = document.createElement('div');

      var rate = 40 / 72;
      var img = document.createElement('img');
      img.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
      img.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(img, iconData, rate);

      imgContainer.appendChild(img);
      div.appendChild(imgContainer);

      if(isChangeToResource){
        imgContainer.classList.add('risingMessageSkillImgToChange');

        var arrowDiv = document.createElement('div');
        arrowDiv.classList.add('risingMessageArrow');
        div.appendChild(arrowDiv);

        var resourceContainer = document.createElement('div');
        resourceContainer.classList.add('risingMessageResource');
        var img = document.createElement('img');
        if(skillData.exchangeToGold){
          img.src = "../images/GoldIcon.png";
          var amount = skillData.exchangeToGold;
          var span = document.createElement('span');
          span.innerHTML = "<span class='yellow'> : </span>" + amount;
        }else if(skillData.exchangeToJewel){
          img.src = "../images/JewelIcon.png";
          amount = skillData.exchangeToJewel;
          var span = document.createElement('span');
          span.innerHTML = "<span class='yellow'> : </span>&nbsp;" + amount;
        }
        resourceContainer.appendChild(img);
        resourceContainer.appendChild(span);

        div.appendChild(resourceContainer);
      }else{
        imgContainer.classList.add('risingMessageSkillImg');
      }

      risingMessageContainer.appendChild(div);
      setTimeout(function(){
        div.classList.add('risingMessageAniForSkill');
      }, 50);
      setTimeout(function(){
        risingMessageContainer.removeChild(div);
      }, 3000);
    }, delayTime);
  },
  updateBuffIcon : function(passiveList, buffList, auraList, timeDiff){
    while(gameSceneBuffsContainer.firstChild){
      gameSceneBuffsContainer.removeChild(gameSceneBuffsContainer.firstChild);
    }
    gameSceneBuffsContainer.innerHTML = '';
    var rate = 36 / 72;
    if(inherentPassiveSkillData){
      var buffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', inherentPassiveSkillData.buffToSelf));
      var div = document.createElement('div');
      div.setAttribute('buffGroupIndex', inherentPassiveSkillData.buffToSelf);
      var imgContainer = document.createElement('div');
      imgContainer.classList.add('buffImgContainer');
      var img = document.createElement('img');
      // img.src = buffGroupData.buffIcon;
      img.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', buffGroupData.buffIcon));
      img.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(img, iconData, rate);

      imgContainer.appendChild(img);
      div.appendChild(imgContainer);
      gameSceneBuffsContainer.appendChild(div);
      div.addEventListener('mouseover', buffTooltipOnHandler.bind(div), false);
      div.addEventListener('mouseout', bottomTooltipOffHandler.bind(div), false);
    }
    if(passiveList){
      for(var i=0; i<passiveList.length; i++){
        var passiveData = objectAssign({}, util.findData(buffGroupTable, 'index', passiveList[i]));
        var div = document.createElement('div');
        var imgContainer = document.createElement('div');
        imgContainer.classList.add('buffImgContainer');
        div.setAttribute('buffGroupIndex', passiveData.index);
        var img = document.createElement('img');
        // img.src = passiveData.buffIcon;
        img.src = resourceUI;
        var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', passiveData.buffIcon));
        img.style.clip = util.makeCssClipStyle(iconData, rate);
        util.setImgCssStyle(img, iconData, rate);

        imgContainer.appendChild(img);
        div.appendChild(imgContainer);
        gameSceneBuffsContainer.appendChild(div);
        div.addEventListener('mouseover', buffTooltipOnHandler.bind(div), false);
        div.addEventListener('mouseout', bottomTooltipOffHandler.bind(div), false);
      }
    }
    if(auraList){
      for(var i=0; i<auraList.length; i++){
        var auraData = objectAssign({}, util.findData(buffGroupTable, 'index', auraList[i]));
        var div = document.createElement('div');
        var imgContainer = document.createElement('div');
        imgContainer.classList.add('buffImgContainer');
        div.setAttribute('buffGroupIndex', auraData.index);
        var img = document.createElement('img');
        // img.src = passiveData.buffIcon;
        img.src = resourceUI;
        var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', auraData.buffIcon));
        img.style.clip = util.makeCssClipStyle(iconData, rate);
        util.setImgCssStyle(img, iconData, rate);

        imgContainer.appendChild(img);
        div.appendChild(imgContainer);
        gameSceneBuffsContainer.appendChild(div);
        div.addEventListener('mouseover', buffTooltipOnHandler.bind(div), false);
        div.addEventListener('mouseout', bottomTooltipOffHandler.bind(div), false);
      }
    }
    if(buffList){
      for(var i=0; i<buffList.length; i++){
        (function doEndAni(){
          var buffData = objectAssign({}, util.findData(buffGroupTable, 'index', buffList[i].id));
          var lifeTime = buffData.buffLifeTime;
          var clientStartTime = buffList[i].st + timeDiff;
          var pastTime = Date.now() - clientStartTime;
          var buffListItem = buffList[i];

          var div = document.createElement('div');
          div.setAttribute('buffGroupIndex', buffData.index);
          var imgContainer = document.createElement('div');
          imgContainer.classList.add('buffImgContainer');
          var img = document.createElement('img');
          // img.src = buffData.buffIcon;
          img.src = resourceUI;
          var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', buffData.buffIcon));
          img.style.clip = util.makeCssClipStyle(iconData, rate);
          util.setImgCssStyle(img, iconData, rate);

          imgContainer.appendChild(img);
          div.appendChild(imgContainer);
          gameSceneBuffsContainer.appendChild(div);
          div.addEventListener('mouseover', buffTooltipOnHandler.bind(div), false);
          div.addEventListener('mouseout', bottomTooltipOffHandler.bind(div), false);

          var checkBuffLifeTimeHandler = function(){
            pastTime = Date.now() - clientStartTime;
            if(lifeTime - pastTime <= 5000){
              div.classList.add('buffBeforeEndAni');
            }else{
              setTimeout(checkBuffLifeTimeHandler, 100);
            }
          };
          setTimeout(checkBuffLifeTimeHandler, 100);
        })();
      }
    }
  },
  initPopUpSkillChanger : function(){
    popUpSkillChange = document.getElementById('popUpSkillChange');
    popUpCloseBtn = document.getElementById('popUpCloseBtn');
    popUpSkillContainer = document.getElementById('popUpSkillContainer');
    popUpBackground = document.getElementById('popUpBackground');

    popUpSkillInfoAndBtn = document.getElementById('popUpSkillInfoAndBtn');
    popUpSkillInfoIcon = document.getElementById('popUpSkillInfoIcon');
    popUpSkillInfoIcon.onclick = clearSelectedPanel;
    popUpSkillInfoDesc = document.getElementById('popUpSkillInfoDesc');
    skillUpgradeEffect = document.getElementById('skillUpgradeEffect');
    popUpSkillUpgradeCostGold = document.getElementById('popUpSkillUpgradeCostGold');
    popUpSkillUpgradeCostJewel = document.getElementById('popUpSkillUpgradeCostJewel');
    popUpSkillUpgradeBtn = document.getElementById('popUpSkillUpgradeBtn');
    popUpSkillTutorialClickText1 = document.getElementById('popUpSkillTutorialClickText1');
    popUpSkillTutorialClickText2 = document.getElementById('popUpSkillTutorialClickText2');
    popUpSkillTutorialArrow = document.getElementById('popUpSkillTutorialArrow');
    popUpSkillTextSkillInfo = document.getElementById('popUpSkillTextSkillInfo');
    popUpCancelSkillSelectBtn = document.getElementById('popUpCancelSkillSelectBtn');
    popUpCancelSkillSelectBtn.onclick = clearSelectedPanel;

    popUpEquipBaseSkill = document.getElementById('popUpEquipBaseSkill');
    popUpEquipSkillsContainer = document.getElementById('popUpEquipSkillsContainer');
    popUpEquipSkill1 = document.getElementById('popUpEquipSkill1');
    popUpEquipSkill2 = document.getElementById('popUpEquipSkill2');
    popUpEquipSkill3 = document.getElementById('popUpEquipSkill3');
    popUpEquipSkill4 = document.getElementById('popUpEquipSkill4');
    popUpEquipPassiveSkill = document.getElementById('popUpEquipPassiveSkill');
    popUpSortType = document.getElementById('popUpSortType');
    popUpSortBtn = document.getElementById('popUpSortBtn');
  },
  checkPopUpSkillChange : function(){
    var needRefresh = false;

    var equipSkillIndex1 = parseInt(popUpEquipSkill1.getAttribute('skillIndex'));
    var equipSkillIndex2 = parseInt(popUpEquipSkill2.getAttribute('skillIndex'));
    var equipSkillIndex3 = parseInt(popUpEquipSkill3.getAttribute('skillIndex'));
    var equipSkillIndex4 = parseInt(popUpEquipSkill4.getAttribute('skillIndex'));
    if(equipSkills[0] && equipSkillIndex1 !== equipSkills[0]){
      needRefresh = true;
    }
    if(equipSkills[1] && equipSkillIndex2 !== equipSkills[1]){
      needRefresh = true;
    }
    if(equipSkills[2] && equipSkillIndex3 !== equipSkills[2]){
      needRefresh = true;
    }
    if(equipSkills[3] && equipSkillIndex4 !== equipSkills[3]){
      needRefresh = true;
    }

    var containerItems = popUpSkillContainer.children;
    for(var i=0; i<containerItems.length; i++){
      var isExist = false;
      var skillIndex = parseInt(containerItems[i].getAttribute('skillIndex'));
      for(var j=0; j<possessSkills.length; j++){
        if(skillIndex === possessSkills[j]){
          isExist = true;
          break;
        }
      }
      if(!isExist){
        needRefresh = true;
      }
    }
    return needRefresh;
  },
  upgradeBaseSkill : function(afterSkillIndex, afterSkillData){
    var beforeSkillIndex = baseSkill;
    baseSkill = afterSkillIndex;
    baseSkillData = afterSkillData;
    if(selectedSkillIndex === beforeSkillIndex){
      this.updateSelectedPanel(afterSkillIndex);
    }
    this.updateDOMElementsSkillIndex(beforeSkillIndex, afterSkillIndex);
    // isServerResponse = true;
    // popUpSkillUpgradeBtn.getElementsByTagName('span')[0].classList.remove('disable');
    // popUpSkillUpgradeBtn.getElementsByTagName('img')[0].classList.add('disable');
    // if(this.serverResponseTimeout){
    //   clearTimeout(this.serverResponseTimeout);
    //   this.serverResponseTimeout = false;
    // }
  },
  upgradeInherentSkill : function(afterSkillIndex, afterSkillData){
    var beforeSkillIndex = inherentPassiveSkill;
    inherentPassiveSkill = afterSkillIndex;
    inherentPassiveSkillData = afterSkillData;
    if(selectedSkillIndex === beforeSkillIndex){
      this.updateSelectedPanel(afterSkillIndex);
    }
    this.updateDOMElementsSkillIndex(beforeSkillIndex, afterSkillIndex);
    // isServerResponse = true;
    // popUpSkillUpgradeBtn.getElementsByTagName('span')[0].classList.remove('disable');
    // popUpSkillUpgradeBtn.getElementsByTagName('img')[0].classList.add('disable');
    // if(this.serverResponseTimeout){
    //   clearTimeout(this.serverResponseTimeout);
    //   this.serverResponseTimeout = false;
    // }
  },
  upgradePossessionSkill : function(beforeSkillIndex, afterSkillIndex){
    for(var i=0; i<possessSkills.length; i++){
      if(possessSkills[i] === beforeSkillIndex){
        var index = possessSkills.indexOf(beforeSkillIndex);
        possessSkills.splice(index, 1, afterSkillIndex);
        break;
      }
    }
    for(var i=0; i<equipSkills.length; i++){
      if(equipSkills[i] === beforeSkillIndex){
        var index = equipSkills.indexOf(beforeSkillIndex);
        equipSkills.splice(index, 1, afterSkillIndex);
        var skillData = objectAssign({}, util.findData(skillTable, 'index', afterSkillIndex));
        equipSkillDatas.splice(index, 1, skillData);
        break;
      }
    }
    if(selectedSkillIndex === beforeSkillIndex){
      this.updateSelectedPanel(afterSkillIndex);
    }
    this.updateDOMElementsSkillIndex(beforeSkillIndex, afterSkillIndex);
    isServerResponse = true;
    popUpSkillUpgradeBtn.getElementsByTagName('span')[0].classList.remove('disable');
    popUpSkillUpgradeBtn.getElementsByTagName('img')[0].classList.add('disable');
    if(this.serverResponseTimeout){
      clearTimeout(this.serverResponseTimeout);
      this.serverResponseTimeout = false;
    }
  },
  playSkillUpgradeEffect : function(){
    skillUpgradeEffect.classList.remove('skillUpgradeEffectAni');
    setTimeout(function(){
      skillUpgradeEffect.classList.add('skillUpgradeEffectAni');
    }, 50);
  },
  updateDOMElementsSkillIndex : function(beforeSkillIndex, afterSkillIndex){
    var divs = document.querySelectorAll('[skillIndex="' + beforeSkillIndex + '"]');
    var afterData = objectAssign({}, util.findData(skillTable, 'index', afterSkillIndex));

    // var rate = 85 / 72;
    for(var i=0; i<divs.length; i++){
      divs[i].setAttribute('skillIndex', afterSkillIndex);
      // divs[i].getElementsByTagName('img')[0].src = afterData.skillIcon;
      // divs[i].getElementsByTagName('img')[0].src = resourceUI;

      // var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', afterData.skillIcon));
      // divs[i].getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
      // util.setImgCssStyle(divs[i].getElementsByTagName('img')[0], iconData, rate);
    }
    this.setHUDSkills()
  },
  setPopUpSkillChange : function(dontUpdateEquip, isMaintainSelect){
    if(isMaintainSelect){
      var selectSkillIndex = selectedSkillIndex;
      clearSelectedPanel();
    }
    while(popUpEquipBaseSkill.firstChild){
      popUpEquipBaseSkill.removeChild(popUpEquipBaseSkill.firstChild);
    }
    while(popUpEquipSkill1.firstChild){
      popUpEquipSkill1.removeChild(popUpEquipSkill1.firstChild);
    }
    while(popUpEquipSkill2.firstChild){
      popUpEquipSkill2.removeChild(popUpEquipSkill2.firstChild);
    }
    while(popUpEquipSkill3.firstChild){
      popUpEquipSkill3.removeChild(popUpEquipSkill3.firstChild);
    }
    while(popUpEquipSkill4.firstChild){
      popUpEquipSkill4.removeChild(popUpEquipSkill4.firstChild);
    }
    while(popUpEquipPassiveSkill.firstChild){
      popUpEquipPassiveSkill.removeChild(popUpEquipPassiveSkill.firstChild);
    }
    popUpEquipSkill1.removeAttribute('skillIndex');
    popUpEquipSkill2.removeAttribute('skillIndex');
    popUpEquipSkill3.removeAttribute('skillIndex');
    popUpEquipSkill4.removeAttribute('skillIndex');

    var imgContainer = document.createElement('div');
    imgContainer.classList.add('popUpskillImgContainer');
    var baseImg = document.createElement('img');
    // baseImg.src = baseSkillData.skillIcon;
    baseImg.src = resourceUI;
    var rate = 60 / 72;
    var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', baseSkillData.skillIcon));
    baseImg.style.clip = util.makeCssClipStyle(iconData, rate);
    util.setImgCssStyle(baseImg, iconData, rate);

    popUpEquipBaseSkill.setAttribute('skillIndex', baseSkill);
    imgContainer.appendChild(baseImg);
    popUpEquipBaseSkill.appendChild(imgContainer);
    popUpEquipBaseSkill.onclick = changeEquipSkillHandler.bind(this, popUpEquipBaseSkill, gameConfig.SKILL_CHANGE_PANEL_EQUIP, dontUpdateEquip);

    var imgContainer = document.createElement('div');
    imgContainer.classList.add('popUpskillImgContainer');
    var inherentPassiveSkillImg = document.createElement('img');
    // inherentPassiveSkillImg.src = inherentPassiveSkillData.skillIcon;
    inherentPassiveSkillImg.src = resourceUI;
    var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', inherentPassiveSkillData.skillIcon));
    inherentPassiveSkillImg.style.clip = util.makeCssClipStyle(iconData, rate);
    util.setImgCssStyle(inherentPassiveSkillImg, iconData, rate);

    popUpEquipPassiveSkill.setAttribute('skillIndex', inherentPassiveSkill);
    imgContainer.appendChild(inherentPassiveSkillImg);
    popUpEquipPassiveSkill.appendChild(imgContainer);
    popUpEquipPassiveSkill.onclick = changeEquipSkillHandler.bind(this, popUpEquipPassiveSkill, gameConfig.SKILL_CHANGE_PANEL_EQUIP, dontUpdateEquip);

    rate = 75 / 72;
    if(equipSkillDatas[0]){
      var equipSkills1 = document.createElement('img');
      var imgContainer = document.createElement('div');
      imgContainer.classList.add('popUpskillImgContainer');
      // equipSkills1.src = equipSkillDatas[0].skillIcon;
      equipSkills1.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[0].skillIcon));
      equipSkills1.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(equipSkills1, iconData, rate);

      popUpEquipSkill1.setAttribute('skillIndex', equipSkillDatas[0].index);
      imgContainer.appendChild(equipSkills1);
      popUpEquipSkill1.appendChild(imgContainer);
    }
    if(equipSkillDatas[1]){
      var imgContainer = document.createElement('div');
      imgContainer.classList.add('popUpskillImgContainer');
      var equipSkills2 = document.createElement('img');
      // equipSkills2.src = equipSkillDatas[1].skillIcon;
      equipSkills2.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[1].skillIcon));
      equipSkills2.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(equipSkills2, iconData, rate);
      popUpEquipSkill2.setAttribute('skillIndex', equipSkillDatas[1].index);
      imgContainer.appendChild(equipSkills2);
      popUpEquipSkill2.appendChild(imgContainer);
    }
    if(equipSkillDatas[2]){
      var imgContainer = document.createElement('div');
      imgContainer.classList.add('popUpskillImgContainer');
      var equipSkills3 = document.createElement('img');
      // equipSkills3.src = equipSkillDatas[2].skillIcon;
      equipSkills3.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[2].skillIcon));
      equipSkills3.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(equipSkills3, iconData, rate);
      popUpEquipSkill3.setAttribute('skillIndex', equipSkillDatas[2].index);
      imgContainer.appendChild(equipSkills3);
      popUpEquipSkill3.appendChild(imgContainer);
    }
    if(equipSkillDatas[3]){
      var imgContainer = document.createElement('div');
      imgContainer.classList.add('popUpskillImgContainer');
      var equipSkills4 = document.createElement('img');
      // equipSkills4.src = equipSkillDatas[3].skillIcon;
      equipSkills4.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[3].skillIcon));
      equipSkills4.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(equipSkills4, iconData, rate);
      popUpEquipSkill4.setAttribute('skillIndex', equipSkillDatas[3].index);
      imgContainer.appendChild(equipSkills4);
      popUpEquipSkill4.appendChild(imgContainer);
    }
    popUpEquipSkill1.onclick = changeEquipSkillHandler.bind(this, popUpEquipSkill1, gameConfig.SKILL_CHANGE_PANEL_EQUIP, dontUpdateEquip);
    popUpEquipSkill2.onclick = changeEquipSkillHandler.bind(this, popUpEquipSkill2, gameConfig.SKILL_CHANGE_PANEL_EQUIP, dontUpdateEquip);
    popUpEquipSkill3.onclick = changeEquipSkillHandler.bind(this, popUpEquipSkill3, gameConfig.SKILL_CHANGE_PANEL_EQUIP, dontUpdateEquip);
    popUpEquipSkill4.onclick = changeEquipSkillHandler.bind(this, popUpEquipSkill4, gameConfig.SKILL_CHANGE_PANEL_EQUIP, dontUpdateEquip);

    popUpSortType.onclick = popUpSortTypeClickHandler.bind(this);
    popUpSortBtn.onclick = popUpSortBtnClickHandler.bind(this, dontUpdateEquip);
    popUpSortBtn.onclick();
    if(selectSkillIndex){
      var selectSkillDiv = popUpSkillChange.querySelectorAll('[skillIndex="' + selectSkillIndex + '"]')[0];
      selectSkillDiv.onclick();
    }
  },
  updateSelectedPanel : function(skillIndex){
    while(popUpSkillInfoIcon.firstChild){
      popUpSkillInfoIcon.removeChild(popUpSkillInfoIcon.firstChild);
    }
    while(popUpSkillInfoDesc.firstChild){
      popUpSkillInfoDesc.removeChild(popUpSkillInfoDesc.firstChild);
    }

    popUpSkillUpgradeCostGold.innerHTML = "";
    popUpSkillUpgradeCostJewel.innerHTML = "";

    popUpCancelSkillSelectBtn.classList.add('disable');


    if(skillIndex){
      var baseSkillIndex = parseInt(popUpEquipBaseSkill.getAttribute('skillIndex'));
      var basePassiveSkillIndex = parseInt(popUpEquipPassiveSkill.getAttribute('skillIndex'));

      selectedSkillIndex = skillIndex;

      var skillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));
      var skillImg = document.createElement('img');

      if(skillData.nextSkillIndex !== -1){
        var nextSkillData = objectAssign({}, util.findData(skillTable, 'index', skillData.nextSkillIndex));
      }

      var output = makeSkillTooltipString(skillData, nextSkillData).replace(/&nbsp;/g, '<br>');
      popUpSkillInfoDesc.innerHTML = output;
      if(nextSkillData){
        var imgTags = popUpSkillInfoDesc.getElementsByTagName('img');
        for(var i=0; i<imgTags.length; i++){
          imgTags[i].classList.remove('disable');
        }
      }

      // skillImg.src = skillData.skillIcon;
      skillImg.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
      var rate = 75/72;
      skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(skillImg, iconData, rate);
      popUpSkillInfoIcon.appendChild(skillImg);

      if (skillIndex !== baseSkillIndex && skillIndex !== basePassiveSkillIndex) {
        var goldAmount = parseInt(goldContainer.innerText);
        var jewelAmount = parseInt(jewelContainer.innerText);

        var color = "white";
        if(goldAmount >= skillData.upgradeGoldAmount){
          color = "green"
        }else{
          color = "red"
        }
        popUpSkillUpgradeCostGold.innerHTML = "<span class='" + color + "'>" + skillData.upgradeGoldAmount + "<br>/ " + goldAmount;

        if(jewelAmount >= skillData.upgradeJewelAmount){
          color = "green"
        }else{
          color = "red"
        }
        popUpSkillUpgradeCostJewel.innerHTML = "<span class='" + color + "'>" + skillData.upgradeJewelAmount + "<br>/ " + jewelAmount;
        popUpSkillUpgradeBtn.onclick = skillUpgradeBtnHandler.bind(this, skillData);

        popUpCancelSkillSelectBtn.classList.remove('disable');
        if(skillData.nextSkillIndex !== -1){
          popUpSkillUpgradeBtn.getElementsByTagName('span')[0].innerHTML = "Upgrade";
          skillUpgradeBlockMask.classList.add('disable');
        }else{
          popUpSkillUpgradeBtn.getElementsByTagName('span')[0].innerHTML = "Max Level";
          skillUpgradeBlockMask.classList.remove('disable');
          popUpSkillUpgradeCostGold.innerHTML = "";
          popUpSkillUpgradeCostJewel.innerHTML = "";
        }
      } else {
        popUpSkillUpgradeBtn.onclick = new Function();
        popUpSkillUpgradeBtn.getElementsByTagName('span')[0].innerHTML = " ";
        skillUpgradeBlockMask.classList.remove('disable');
      }
      // popUpSkillInfoIcon.appendChild(skillImg);
      // popUpSkillUpgradeBtn.addEventListener('click', skillUpgradeBtnHandler, false);
    }else{
      popUpSkillUpgradeBtn.onclick = new Function();
      popUpSkillUpgradeBtn.getElementsByTagName('span')[0].innerHTML = " ";
      skillUpgradeBlockMask.classList.remove('disable');
    }
  },
  closePopUpSkillChange : function(){
    if(popUpSkillChange.classList.contains('enable')){
      clearSelectedPanel();
      popChange(popUpSkillChange);
      popUpSortBtn.onclick();
    }
  },
  setBoard : function(userDatas, userID){
    var rankers = [];

    var rank = [];
    var userRank = 0;
    var userName = "";
    var userKillScore = 0;
    userDatas.sort(function(a, b){
      return b.tS - a.tS;
    });
    for(var i=0; i<userDatas.length; i++){
      if(userID === userDatas[i].id){
        userRank = i + 1;
        userName = userDatas[i].nm;
        userLevel = userDatas[i].lv;
        userKillScore = userDatas[i].kS;
        userScore = userDatas[i].tS;
        userTotalKillCount = userDatas[i].tK;
        this.updateKillCount(userKillScore, userTotalKillCount);
      }
      if(i === 0 || i === 1 || i === 2){
        rankers.push(userDatas[i].id);
      }
      rank.push({rank : i + 1, name : userDatas[i].nm, level:userDatas[i].lv, kill : userDatas[i].kS, score : userDatas[i].tS, totalKill : userDatas[i].tK});
    }

    var rankOutput = "<h3>Rank</h3><hr>";
    var nameOutput = "<h3>Name</h3><hr>";
    var levelOutput = "<h3>Level</h3><hr>";
    var killScoreOutput = "<h3>Kills</h3><hr>";
    var totalScoreOutput = "<h3>Score</h3><hr>";
    var totalKillCountOutput = "<h3>TotalKill</h3><hr>";
    var output = "";
    var length = rank.length > 10 ? 10 : rank.length;

    for(var i=0; i<length; i++){
      var isRanker = false;
      if(i === 0 || i === 1 || i === 2){
        isRanker = true;
      }
      if(userRank <= 10 && userRank === i + 1){
        if(isRanker){
          if(i == 0){
            rankOutput += "<img src='/images/rank1Icon.png'/>";
          }else if(i === 1){
            rankOutput += "<img src='/images/rank2Icon.png'/>";
          }else{
            rankOutput += "<img src='/images/rank3Icon.png'/>";
          }
          nameOutput += "<p class='user ranker'>" + rank[i].name + "</p>";
          levelOutput += "<p class='user ranker'>" + rank[i].level + "</p>";
          killScoreOutput += "<p class='user ranker'>" + rank[i].kill + "</p>";
          totalScoreOutput += "<p class='user ranker'>" + rank[i].score + "</p>";
          totalKillCountOutput += "<p class='user ranker'>" + rank[i].totalKill + "</p>";
        }else{
          rankOutput += "<p class='user'>" + rank[i].rank + "</p>";
          nameOutput += "<p class='user'>" + rank[i].name + "</p>";
          levelOutput += "<p class='user'>" + rank[i].level + "</p>";
          killScoreOutput += "<p class='user'>" + rank[i].kill + "</p>";
          totalScoreOutput += "<p class='user'>" + rank[i].score + "</p>";
          totalKillCountOutput += "<p class='user'>" + rank[i].totalKill + "</p>";
        }
      }else{
        if(isRanker){
          if(i == 0){
            rankOutput += "<img src='/images/rank1Icon.png'/>";
          }else if(i === 1){
            rankOutput += "<img src='/images/rank2Icon.png'/>";
          }else{
            rankOutput += "<img src='/images/rank3Icon.png'/>";
          }
          nameOutput += "<p class='ranker'>" + rank[i].name + "</p>";
          levelOutput += "<p class='ranker'>" + rank[i].level + "</p>";
          killScoreOutput += "<p class='ranker'>" + rank[i].kill + "</p>";
          totalScoreOutput += "<p class='ranker'>" + rank[i].score + "</p>";
          totalKillCountOutput += "<p class='ranker'>" + rank[i].totalKill + "</p>";
        }else{
          rankOutput += "<p>" + rank[i].rank + "</p>";
          nameOutput += "<p>" + rank[i].name + "</p>";
          levelOutput += "<p>" + rank[i].level + "</p>";
          killScoreOutput += "<p>" + rank[i].kill + "</p>";
          totalScoreOutput += "<p>" + rank[i].score + "</p>";
          totalKillCountOutput += "<p>" + rank[i].totalKill + "</p>";
        }
      }
    }
    if(userRank > 10){
      rankOutput += "<p class='user' style='font-size: 12px'>" + userRank + "</p>";
      nameOutput += "<p class='user' style='font-size: 12px'>" + userName + "</p>";
      levelOutput += "<p class='user' style='font-size: 12px'>" + userLevel + "</p>";
      killScoreOutput += "<p class='user' style='font-size: 12px'>" + userKillScore + "</p>";
      totalScoreOutput += "<p class='user' style='font-size: 12px'>" + userScore + "</p>";
      totalKillCountOutput += "<p class='user' style='font-size: 12px'>" + userTotalKillCount + "</p>";
    }
    // if(userRank > 10){
    //   output += rank[i].rank + ' : ' + rank[i].name + ' : ' + rank[i].kill;
    // }
    // gameSceneHudTopRight.innerHTML = "";
    // gameSceneHudTopRight.innerHTML = output;
    gameBoardRank.innerHTML = rankOutput;
    gameBoardName.innerHTML = nameOutput;
    gameBoardLevel.innerHTML = levelOutput;
    gameBoardKillScore.innerHTML = killScoreOutput;
    gameBoardTotalKillCount.innerHTML = totalKillCountOutput;
    gameBoardTotalScore.innerHTML = totalScoreOutput;

    this.onSetRankers(rankers);
  },
  updateBoard : function(userDatas, userID){
    this.setBoard(userDatas, userID);
  },
  updateKillBoard : function(attackUserInfo, deadUserInfo){
    // gameSceneHudTopLeft.classList.remove('disappearSmoothAni');
    // gameSceneHudTopLeft.classList.remove('disable');

    // if(killBoardDisableTimeout){
    //   clearTimeout(killBoardDisableTimeout);
    // }
    var spanEle = document.createElement('span');
    spanEle.classList.add('killFeedBack');

    var output = "";
    var attackUserColor = "white";
    var deadUserColor = "white";
    switch (attackUserInfo.tp) {
      case gameConfig.CHAR_TYPE_FIRE:
        attackUserColor = 'red';
        break;
      case gameConfig.CHAR_TYPE_FROST:
        attackUserColor = 'blue';
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        attackUserColor = 'purple';
        break;
    }
    switch (deadUserInfo.tp) {
      case gameConfig.CHAR_TYPE_FIRE:
        deadUserColor = 'red';
        break;
      case gameConfig.CHAR_TYPE_FROST:
        deadUserColor = 'blue';
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        deadUserColor = 'purple';
        break;
    }
    if(!attackUserInfo.nm){
      var attackUserName = 'NoName';
    }else{
      attackUserName = attackUserInfo.nm;
    }
    if(!deadUserInfo.nm){
      var deadUserName = 'NoName';
    }else{
      deadUserName = deadUserInfo.nm;
    }
    if(attackUserInfo.uID === deadUserInfo.uID){
      output += '&nbsp; <span class=' + attackUserColor + '>' + attackUserName + '</span>';
      output += '&nbsp; commit suicide'
    }else if(attackUserInfo.fl){
      switch (attackUserInfo.fl) {
        case gameConfig.KILL_FEEDBACK_LEVEL_0:
          break;
        case gameConfig.KILL_FEEDBACK_LEVEL_1:
          output += '<span class="feedbackLevel1 feedback" style="color : ' + gameConfig.KILL_FEEDBACK_LEVEL_1_COLOR + '">' + gameConfig.KILL_FEEDBACK_LEVEL_1_PREFIX + '</span>';
          setTimeout(function(){
            var prefix = gameSceneHudTopLeft.getElementsByClassName('feedbackLevel1')[0];
            prefix.classList.remove('feedbackLevel1');
          }, 50);
          break;
        case gameConfig.KILL_FEEDBACK_LEVEL_2:
          output += '<span class="feedbackLevel2 feedback" style="color : ' + gameConfig.KILL_FEEDBACK_LEVEL_2_COLOR + '">' + gameConfig.KILL_FEEDBACK_LEVEL_2_PREFIX + '</span>';
          setTimeout(function(){
            var prefix = gameSceneHudTopLeft.getElementsByClassName('feedbackLevel2')[0];
            prefix.classList.remove('feedbackLevel2');
          }, 50);
          break;
        case gameConfig.KILL_FEEDBACK_LEVEL_3:
          output += '<span class="feedbackLevel3 feedback" style="color : ' + gameConfig.KILL_FEEDBACK_LEVEL_3_COLOR + '">' + gameConfig.KILL_FEEDBACK_LEVEL_3_PREFIX + '</span>';
          setTimeout(function(){
            var prefix = gameSceneHudTopLeft.getElementsByClassName('feedbackLevel3')[0];
            prefix.classList.remove('feedbackLevel3');
          }, 50);
          break;
        case gameConfig.KILL_FEEDBACK_LEVEL_4:
          output += '<span class="feedbackLevel4 feedback" style="color : ' + gameConfig.KILL_FEEDBACK_LEVEL_4_COLOR + '">' + gameConfig.KILL_FEEDBACK_LEVEL_4_PREFIX + '</span>';
          setTimeout(function(){
            var prefix = gameSceneHudTopLeft.getElementsByClassName('feedbackLevel4')[0];
            prefix.classList.remove('feedbackLevel4');
          }, 50);
          break;
        case gameConfig.KILL_FEEDBACK_LEVEL_5:
          output += '<span class="feedbackLevel5 feedback" style="color : ' + gameConfig.KILL_FEEDBACK_LEVEL_5_COLOR + '">' + gameConfig.KILL_FEEDBACK_LEVEL_5_PREFIX + '</span>';
          setTimeout(function(){
            var prefix = gameSceneHudTopLeft.getElementsByClassName('feedbackLevel5')[0];
            prefix.classList.remove('feedbackLevel5');
          }, 50);
          break;
        case gameConfig.KILL_FEEDBACK_LEVEL_6:
          output += '<span class="feedbackLevel6 feedback" style="color : ' + gameConfig.KILL_FEEDBACK_LEVEL_6_COLOR + '">' + gameConfig.KILL_FEEDBACK_LEVEL_6_PREFIX + '</span>';
          setTimeout(function(){
            var prefix = gameSceneHudTopLeft.getElementsByClassName('feedbackLevel6')[0];
            prefix.classList.remove('feedbackLevel6');
          }, 50);
          break;
        case gameConfig.KILL_FEEDBACK_LEVEL_7:
          output += '<span class="feedbackLevel7 feedback" style="color : ' + gameConfig.KILL_FEEDBACK_LEVEL_7_COLOR + '">' + gameConfig.KILL_FEEDBACK_LEVEL_7_PREFIX + '</span>';
          setTimeout(function(){
            var prefix = gameSceneHudTopLeft.getElementsByClassName('feedbackLevel7')[0];
            prefix.classList.remove('feedbackLevel7');
          }, 50);
          break;
      }
      output += '&nbsp; <span class=' + attackUserColor + '>' + attackUserName + '</span>';
      output += '&nbsp;&nbsp; kill ';
      output += '&nbsp; <span class=' + deadUserColor + '>' + deadUserName + '</span>';
    }else{
      output += '&nbsp; <span class=' + attackUserColor + '>' + attackUserName + '</span>';
      output += '&nbsp;&nbsp;  kill ';
      output += '&nbsp; <span class=' + deadUserColor + '>' + deadUserName + '</span>';
    }
    output += '&nbsp;!!!<br>';

    spanEle.innerHTML = output;
    var spans = gameSceneHudTopLeft.getElementsByClassName('killFeedBack');
    while(spans.length >= 5){
      gameSceneHudTopLeft.removeChild(spans[0]);
    }
    gameSceneHudTopLeft.appendChild(spanEle);
    // killBoardDisableTimeout =
    setTimeout(function(){
      spanEle.classList.add('disappearSmoothAni');
      setTimeout(function(){
        // if(spanEle.classList.contains('disappearSmoothAni')){
        spanEle.classList.remove('disappearSmoothAni');
        spanEle.classList.add('disable');
        // }
      }, 1000);
    }, 5000);
  },
  setMiniMapChests : function(chestDatas, chestLocationDatas){
    miniMapChest1.setAttribute('locationID', chestLocationDatas[0].id);
    miniMapChest1.style.left = Math.floor(chestLocationDatas[0].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapChest1.style.top = Math.floor(chestLocationDatas[0].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    miniMapChest2.setAttribute('locationID', chestLocationDatas[1].id);
    miniMapChest2.style.left = Math.floor(chestLocationDatas[1].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapChest2.style.top = Math.floor(chestLocationDatas[1].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    // miniMapChest3.setAttribute('locationID', chestLocationDatas[2].id);
    // miniMapChest3.style.left = Math.floor(chestLocationDatas[2].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    // miniMapChest3.style.top = Math.floor(chestLocationDatas[2].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    // miniMapChest4.setAttribute('locationID', chestLocationDatas[3].id);
    // miniMapChest4.style.left = Math.floor(chestLocationDatas[3].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    // miniMapChest4.style.top = Math.floor(chestLocationDatas[3].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    // miniMapChest5.setAttribute('locationID', chestLocationDatas[4].id);
    // miniMapChest5.style.left = Math.floor(chestLocationDatas[4].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    // miniMapChest5.style.top = Math.floor(chestLocationDatas[4].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    // miniMapChest6.setAttribute('locationID', chestLocationDatas[5].id);
    // miniMapChest6.style.left = Math.floor(chestLocationDatas[5].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    // miniMapChest6.style.top = Math.floor(chestLocationDatas[5].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    // miniMapChest7.setAttribute('locationID', chestLocationDatas[6].id);
    // miniMapChest7.style.left = Math.floor(chestLocationDatas[6].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    // miniMapChest7.style.top = Math.floor(chestLocationDatas[6].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    // miniMapChest8.setAttribute('locationID', chestLocationDatas[7].id);
    // miniMapChest8.style.left = Math.floor(chestLocationDatas[7].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    // miniMapChest8.style.top = Math.floor(chestLocationDatas[7].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    // miniMapChest9.setAttribute('locationID', chestLocationDatas[8].id);
    // miniMapChest9.style.left = Math.floor(chestLocationDatas[8].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    // miniMapChest9.style.top = Math.floor(chestLocationDatas[8].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';

    // var parentDiv = miniMapChest1.parentNode;
    // var childDivs = miniMapChest1.parentNode.getElementsByTagName('div');
    var childDivs = miniMapChest1.parentNode.querySelectorAll('[type=chest]');
    for(var i=0; i<childDivs.length - 1; i++){
      var imgTags = childDivs[i].getElementsByTagName('img');
      imgTags[0].src = gameConfig.MINIMAP_CHEST_GROUND_SRC;
      // childDivs[i].classList.add('chestOff');
    }
    for(var i=0; i<chestDatas.length; i++){
      for(var j=0; j<childDivs.length - 1; j++){
        var locationID = childDivs[j].getAttribute('locationID');
        if(chestDatas[i].lID === locationID){
          var imgTags = childDivs[j].getElementsByTagName('img');
          if(chestDatas[i].gd === 1 || chestDatas[i].gd === 2){
            imgTags[0].src = gameConfig.MINIMAP_CHEST_SRC_1;
          }else if(chestDatas[i].gd === 3 || chestDatas[i].gd === 4){
            imgTags[0].src = gameConfig.MINIMAP_CHEST_SRC_2;
          }else if(chestDatas[i].gd === 5){
            imgTags[0].src = gameConfig.MINIMAP_CHEST_SRC_3;
          }
          // childDivs[j].classList.remove('chestOff');
          // childDivs[j].classList.add('chestOn');
          break;
        }
      }
    }
  },
  setMinimapZones : function(safeZoneDatas, portalZoneDatas){
    var miniMapSafe = document.getElementById('miniMapSafe');
    // var miniMapSafe2 = document.getElementById('miniMapSafe2');
    // var miniMapSafe3 = document.getElementById('miniMapSafe3');
    // var miniMapSafe4 = document.getElementById('miniMapSafe4');
    var miniMapPortal = document.getElementById('miniMapPortal');
    // var miniMapPortal1 = document.getElementById('miniMapPortal1');
    // var miniMapPortal2 = document.getElementById('miniMapPortal2');
    // var miniMapPortal3 = document.getElementById('miniMapPortal3');
    // var miniMapPortal4 = document.getElementById('miniMapPortal4');

    miniMapSafe.style.left = Math.floor(safeZoneDatas[0].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapSafe.style.top = Math.floor(safeZoneDatas[0].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    // miniMapSafe2.style.left = Math.floor(safeZoneDatas[1].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    // miniMapSafe2.style.top = Math.floor(safeZoneDatas[1].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    // miniMapSafe3.style.left = Math.floor(safeZoneDatas[2].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    // miniMapSafe3.style.top = Math.floor(safeZoneDatas[2].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    // miniMapSafe4.style.left = Math.floor(safeZoneDatas[3].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    // miniMapSafe4.style.top = Math.floor(safeZoneDatas[3].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    miniMapPortal.style.left = Math.floor(portalZoneDatas[0].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapPortal.style.top = Math.floor(portalZoneDatas[0].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    // miniMapPortal1.style.left = Math.floor(portalZoneDatas[0].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    // miniMapPortal1.style.top = Math.floor(portalZoneDatas[0].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    // miniMapPortal2.style.left = Math.floor(portalZoneDatas[1].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    // miniMapPortal2.style.top = Math.floor(portalZoneDatas[1].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    // miniMapPortal3.style.left = Math.floor(portalZoneDatas[2].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    // miniMapPortal3.style.top = Math.floor(portalZoneDatas[2].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
    // miniMapPortal4.style.left = Math.floor(portalZoneDatas[3].posX * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    // miniMapPortal4.style.top = Math.floor(portalZoneDatas[3].posY * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
  },
  createChest : function(locationID, grade){
    // var childDivs = miniMapChest1.parentNode.getElementsByTagName('div');
    var childDivs = miniMapChest1.parentNode.querySelectorAll('[type=chest]');
    for(var i=0; i<childDivs.length; i++){
      if(locationID === childDivs[i].getAttribute('locationID')){
        var imgTags = childDivs[i].getElementsByTagName('img');
        if(grade === 1 || grade === 2){
          imgTags[0].src = gameConfig.MINIMAP_CHEST_SRC_1;
          imgTags[0].classList.add('chestAni1');
          imgTags[1].classList.add('chestAni1');
        }else if(grade === 3 || grade === 4){
          imgTags[0].src = gameConfig.MINIMAP_CHEST_SRC_2;
          imgTags[0].classList.add('chestAni2');
          imgTags[1].classList.add('chestAni2');
        }else if(grade === 5){
          imgTags[0].src = gameConfig.MINIMAP_CHEST_SRC_3;
          imgTags[0].classList.add('chestAni3');
          imgTags[1].classList.add('chestAni3');
        }
        imgTags[0].classList.add('chestAni');
        imgTags[1].classList.add('chestAni');
      }
    }
  },
  deleteChest : function(locationID){
    // var childDivs = miniMapChest1.parentNode.getElementsByTagName('div');
    var childDivs = miniMapChest1.parentNode.querySelectorAll('[type=chest]');
    for(var i=0; i<childDivs.length; i++){
      if(locationID === childDivs[i].getAttribute('locationID')){
        var imgTags = childDivs[i].getElementsByTagName('img');
        imgTags[0].src = gameConfig.MINIMAP_CHEST_GROUND_SRC;
        imgTags[0].classList.remove('chestAni');
        imgTags[1].classList.remove('chestAni');
        imgTags[0].classList.remove('chestAni1');
        imgTags[1].classList.remove('chestAni1');
        imgTags[0].classList.remove('chestAni2');
        imgTags[1].classList.remove('chestAni2');
        imgTags[0].classList.remove('chestAni3');
        imgTags[1].classList.remove('chestAni3');
      }
    }
  },
  setUserPosition : function(position){
    miniMapUser.style.left = Math.floor(position.x * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapUser.style.top = Math.floor(position.y * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
  },
  updateUserPosition : function(position){
    miniMapUser.style.left = Math.floor(position.x * 100 / gameConfig.CANVAS_MAX_SIZE.width) + '%';
    miniMapUser.style.top = Math.floor(position.y * 100 / gameConfig.CANVAS_MAX_SIZE.height) + '%';
  },
  showChatInput : function(){
    chatInputContainer.classList.remove('disable');
    chatInput.select();
  },
  getChatMessage : function(){
    return chatInput.value;
  },
  disableChatInput : function(){
    chatInputContainer.classList.add('disable');
  },
  clearChatInput : function(){
    chatInput.value = "";
  },
  playDeadScene : function(userID, killUser, currentLevel, targetLevel, curExp, targetExp, targetJewel, targetGold) { //, toLevel, loseResource, isLostSkill, currentLevel, isInherent){
    gameSceneDeadScene.style.pointerEvents = 'all';

    var deadSceneTextContainer = document.getElementById('deadSceneTextContainer');
    var deadSceneText = document.getElementById('deadSceneText');
    var deadSceneInfoContainer = document.getElementById('deadSceneInfoContainer');

    var deadSceneTop = document.getElementById('deadSceneTop');
    var deadSceneInfoName = document.getElementById('deadSceneInfoName');
    var deadSceneInfoLevel = document.getElementById('deadSceneInfoLevel');
    var deadSceneInfoBaseSkills = document.getElementById('deadSceneInfoBaseSkills');
    var deadSceneBaseSkill = document.getElementById('deadSceneBaseSkill');
    var deadScenePassiveSkill = document.getElementById('deadScenePassiveSkill');
    var baseSkillLevel = deadSceneBaseSkill.getElementsByTagName('span')[0];
    var basePassiveSkillLevel = deadScenePassiveSkill.getElementsByTagName('span')[0];

    var deadSceneBeforeLevel = document.getElementById('deadSceneBeforeLevel');
    var deadSceneAfterLevel = document.getElementById('deadSceneAfterLevel');

    var deadSceneInfoExpText = document.getElementById('deadSceneInfoExpText');
    var deadSceneInfoExpBar = document.getElementById('deadSceneInfoExpBar');

    var deadSceneMid = document.getElementById('deadSceneMid');
    var deadSceneLevelUpText = document.getElementById('deadSceneLevelUpText');
    var deadSceneInfoGold = document.getElementById('deadSceneInfoGold');
    var deadSceneInfoJewel = document.getElementById('deadSceneInfoJewel');

    var deadSceneBottom = document.getElementById('deadSceneBottom');
    var deadSceneInfoNewSkillText = document.getElementById('deadSceneInfoNewSkillText');
    var deadSceneInfoNewSkills = document.getElementById('deadSceneInfoNewSkills');

    var deadSceneConfirm = document.getElementById('deadSceneConfirm');
    var self = this;
    // gameSceneDeadScene.style.display = 'block';
    gameSceneDeadScene.style.width = "100%";
    gameSceneDeadScene.style.height = "100%";

    deadSceneBackground.classList.remove('deadSceneBackgroundDefault')
    deadSceneBackground.classList.add('deadSceneBackgroundAni');

    var text = "";
    if(killUser){
      if(userID === killUser){
        text = "You kill yourself";
      }else{
        text = "You are slain by <span class='yellow'>" + killUser + "</span>";
      }
    }else{
      text = "You are dead";
    }
    deadSceneText.innerHTML = text;

    // name setting
    var name = '';
    var colorClass = '';
    switch (characterType) {
      case gameConfig.CHAR_TYPE_FIRE:
        name = fireCharName;
        colorClass = 'red';
        break;
      case gameConfig.CHAR_TYPE_FROST:
        name = frostCharName;
        colorClass = 'blue';
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        name = arcaneCharName;
        colorClass = 'purple';
        break;
    }
    deadSceneInfoName.innerHTML = "<span class='" + colorClass + "'>" + name + "</span>";

    // skillIcon setting
    var rate = 55/72;
    var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', baseSkillData.skillIcon));
    deadSceneBaseSkill.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
    deadSceneBaseSkill.getElementsByTagName('img')[0].src = resourceUI;
    deadSceneBaseSkill.setAttribute('skillIndex', baseSkillData.index);
    util.setImgCssStyle(deadSceneBaseSkill.getElementsByTagName('img')[0], iconData, rate);
    deadSceneBaseSkill.onmouseover = skillTooltipHandler.bind(deadSceneBaseSkill);
    deadSceneBaseSkill.onmouseout = bottomTooltipOffHandler.bind(deadSceneBaseSkill);

    iconData = objectAssign({}, util.findData(iconResourceTable, 'index', inherentPassiveSkillData.skillIcon));
    deadScenePassiveSkill.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
    deadScenePassiveSkill.getElementsByTagName('img')[0].src = resourceUI;
    deadScenePassiveSkill.setAttribute('skillIndex', inherentPassiveSkillData.index);
    util.setImgCssStyle(deadScenePassiveSkill.getElementsByTagName('img')[0], iconData, rate);
    deadScenePassiveSkill.onmouseover = skillTooltipHandler.bind(deadScenePassiveSkill);
    deadScenePassiveSkill.onmouseout = bottomTooltipOffHandler.bind(deadScenePassiveSkill);

    //play exp ani
    setTimeout(function(){
      deadSceneTextContainer.classList.remove('deadSceneDefault');
      deadSceneTextContainer.classList.add('deadSceneAni');
      deadSceneText.classList.remove('deadSceneDefault');
      deadSceneText.classList.add('deadSceneAni');
    }, 1000);

    setTimeout(function() {
      deadSceneText.innerHTML = '';
      deadSceneText.classList.remove('deadSceneAni');
      deadSceneText.classList.add('deadSceneDefault');
      deadSceneInfoContainer.classList.remove('deadSceneDefault');
      deadSceneInfoContainer.classList.add('deadSceneAni');
      // deadSceneTextContainer.classList.remove('deadSceneAni');
      // deadSceneTextContainer.classList.add('deadSceneDefault');
    }, 3500);
    setTimeout(function() {
      playExpAni();
      // onCompleteExpAni();
    }, 4500);

    baseSkillLevel.innerText = 'Lv.' + (Math.floor(currentLevel / 5) + 1);
    basePassiveSkillLevel.innerText = 'Lv.' + (Math.floor(currentLevel / 5) + 1);

    deadSceneInfoLevel.innerHTML = currentLevel >= 20 ? 'Lv.MAX' : 'Lv.' + currentLevel;
    deadSceneBeforeLevel.innerHTML = currentLevel >= 20 ? 'Lv.MAX' : 'Lv.' + currentLevel;
    deadSceneAfterLevel.innerHTML = 'Lv.' + (currentLevel >= 20 ? '' : currentLevel === 19 ? 'MAX' : currentLevel + 1);
    var currentLevelData = objectAssign({}, util.findData(userStatTable, 'level', currentLevel));
    var targetLevelData = objectAssign({}, util.findData(userStatTable, 'level', targetLevel));
    var targetPercent = Math.floor(targetExp / targetLevelData.needExp * 100);
    var curPercent = Math.floor(curExp / currentLevelData.needExp * 100);
    var levelUpGold = 0;
    var levelUpJewel = 0;
    if (currentLevelData.needExp == -1) {
      curPercent = 100;
    }
    if (curPercent >= 0) {
      deadSceneInfoExpText.innerHTML = curPercent + '%';
      deadSceneInfoExpBar.style.width = curPercent + '%';
    }
    function playExpAni() {
      if (currentLevelData.needExp == -1) {
        // dont need animation
        deadSceneInfoLevel.innerHTML = 'Lv.MAX';
        deadSceneBeforeLevel.innerHTML = 'Lv.MAX';
        deadSceneAfterLevel.innerHTML = '';
        deadSceneInfoExpText.innerHTML = '100%';
        deadSceneInfoExpBar.style.width = '100%';
        onCompleteExpAni();
      } else if (currentLevel >= targetLevel) {
        currentLevel = targetLevel;
        if (curPercent >= targetPercent) {
          curPercent = targetPercent;
          deadSceneInfoLevel.innerHTML = 'Lv.' + currentLevel;
          deadSceneBeforeLevel.innerHTML = 'Lv.' + currentLevel;
          deadSceneAfterLevel.innerHTML = 'Lv.' + (currentLevel >= 20 ? '' : currentLevel === 19 ? 'Lv.MAX' : currentLevel + 1);
          deadSceneInfoExpText.innerHTML = curPercent + '%';
          deadSceneInfoExpBar.style.width = curPercent + '%';
          onCompleteExpAni();
        } else if (targetLevelData.needExp == -1) {
          // fill exp
          curPercent = 100;
          deadSceneInfoLevel.innerHTML = 'Lv.MAX';
          deadSceneBeforeLevel.innerHTML = 'Lv.MAX';
          deadSceneAfterLevel.innerHTML = '';
          deadSceneInfoExpText.innerHTML = '100%';
          deadSceneInfoExpBar.style.width = '100%';
          onCompleteExpAni();
        } else {
          curPercent++
          deadSceneInfoExpText.innerHTML = curPercent + '%';
          deadSceneInfoExpBar.style.width = curPercent + '%';
          setTimeout(playExpAni, 10);
          // add exp
        }
      } else {
        // fill exp bar
        if (curPercent >= 100) {
          // level up
          curPercent = 0;
          currentLevel++;
          currentLevelData = objectAssign({}, util.findData(userStatTable, 'level', currentLevel));
          levelUpGold += currentLevelData.levelUpGold;
          levelUpJewel += currentLevelData.levelUpJewel;
          if (currentLevel % 5 === 0) {
            var newSkillLevel = Math.floor(currentLevel / 5) + 1;
            var newBaseSkillData = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'level', newSkillLevel, 'groupIndex', baseSkillData.groupIndex));
            var newPassiveSkillData = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'level', newSkillLevel, 'groupIndex', inherentPassiveSkillData.groupIndex));
            self.upgradeBaseSkill(newBaseSkillData.index, newBaseSkillData);
            self.upgradeInherentSkill(newPassiveSkillData.index, newPassiveSkillData);
            self.onUpgradeCharSkills(newBaseSkillData, newPassiveSkillData);
            // deadSceneBaseSkill.setAttribute('skillIndex', newBaseSkillData.index);
            // deadScenePassiveSkill.setAttribute('skillIndex', newPassiveSkillData.index);

            baseSkillLevel.classList.add('yellow');
            basePassiveSkillLevel.classList.add('yellow');
            baseSkillLevel.innerText = 'Lv.' + newSkillLevel;
            basePassiveSkillLevel.innerText = 'Lv.' + newSkillLevel;
          }
          deadSceneInfoLevel.innerHTML = 'Lv.' + currentLevel;
          deadSceneBeforeLevel.innerHTML = 'Lv.' + currentLevel;
          deadSceneAfterLevel.innerHTML = 'Lv.' + (currentLevel >= 20 ? '' : currentLevel === 19 ? 'Lv.MAX' : currentLevel + 1);
          deadSceneInfoExpText.innerHTML = '100%';
          deadSceneInfoExpBar.style.width = '100%';
          setTimeout(playExpAni, 200);
        } else {
          curPercent++;
          deadSceneInfoExpText.innerHTML = curPercent + '%';
          deadSceneInfoExpBar.style.width = curPercent + '%';
          setTimeout(playExpAni, 10);
        }
      }
    }

    var curResources = this.getResource();
    deadSceneInfoGold.innerHTML = curResources.gold;
    deadSceneInfoJewel.innerHTML = curResources.jewel;

    function onCompleteExpAni() {
      //show deadSceneMid
      deadSceneMid.classList.remove('deadSceneDefault');
      deadSceneMid.classList.add('deadSceneAni');

      setTimeout( function() {
        if (targetGold - levelUpGold > curResources.gold) { deadSceneInfoGold.classList.add('yellow'); }
        if (targetJewel - levelUpJewel > curResources.jewel) { deadSceneInfoJewel.classList.add('yellow'); }
        playResourceAni();
      }, 1000);
      // setTimeout(function() {
      //   //play resource ani
      //   onCompleteResourceAni();
      // }, 1000);
    }

    var addGoldsPerFrame = 50;
    var addJewelsPerFrame = 1;
    function playResourceAni() {
      if (targetGold - levelUpGold - curResources.gold < addGoldsPerFrame) {
        addGoldsPerFrame = targetGold - levelUpGold - curResources.gold;
      }
      if (targetJewel - levelUpJewel - curResources.jewel < addJewelsPerFrame) {
        addJewelsPerFrame = targetJewel - levelUpJewel - curResources.jewel;
      }
      curResources.gold += addGoldsPerFrame;
      curResources.jewel += addJewelsPerFrame;

      deadSceneInfoGold.innerHTML = curResources.gold;
      deadSceneInfoJewel.innerHTML = curResources.jewel;

      if (curResources.gold >= targetGold - levelUpGold && curResources.jewel >= targetJewel - levelUpJewel) {
        if (levelUpGold || levelUpJewel) {
          playLevelupText();
          setTimeout(function() {
            if (targetGold > curResources.gold) { deadSceneInfoGold.classList.add('yellow'); }
            if (targetJewel > curResources.jewel) { deadSceneInfoJewel.classList.add('yellow'); }
            playLevelUpResource();
          }, 1500);
        } else {
          onCompleteResourceAni();
        }
      } else {
        setTimeout(playResourceAni, 50);
      }
    }
    function playLevelupText() {
      deadSceneLevelUpText.classList.remove('disable');
      deadSceneLevelUpText.classList.add('levelUpTextAni');
    }
    function playLevelUpResource() {
      deadSceneLevelUpText.classList.add('disable');
      deadSceneLevelUpText.classList.remove('levelUpTextAni');

      addGoldsPerFrame = 50;
      addJewelsPerFrame = 1;
      if (targetGold - curResources.gold < addGoldsPerFrame) {
        addGoldsPerFrame = targetGold - curResources.gold;
      }
      if (targetJewel - curResources.jewel < addJewelsPerFrame) {
        addJewelsPerFrame = targetJewel - curResources.jewel;
      }
      curResources.gold += addGoldsPerFrame;
      curResources.jewel += addJewelsPerFrame;

      deadSceneInfoGold.innerHTML = curResources.gold;
      deadSceneInfoJewel.innerHTML = curResources.jewel;

      if (curResources.gold >= targetGold && curResources.jewel >= targetJewel) {
        onCompleteResourceAni();
      } else {
        setTimeout(playLevelUpResource, 50);
      }
    }
    function onCompleteResourceAni() {
      //update resource UI
      self.setResource({ g: targetGold, j: targetJewel });
      //show bottom
      if (beforeGameNewSkills.length) {
        deadSceneBottom.classList.remove('deadSceneDefault');
        deadSceneBottom.classList.add('deadSceneAni');

        setTimeout(playNewSkillAni, 1000);
      } else {
        onCompleteSkillAni();
      }
      // setTimeout(function() {
      //   //play new skill ani
      //   onCompleteSkillAni();
      // }, 1000);
    }
    function playNewSkillAni() {
      var rate = 50 / 72;
      if (beforeGameNewSkills.length) {
        var newSkillIndex = beforeGameNewSkills[0];
        var skillData = objectAssign({}, util.findData(skillTable, 'index', newSkillIndex));
        var skillDiv = document.createElement('div');
        var imgContainer = document.createElement('div');
        imgContainer.classList.add('deadSceneNewSkillImgContainer');
        var skillImg = document.createElement('img');
        imgContainer.setAttribute('skillIndex', newSkillIndex);
        skillDiv.classList.add('deadSceneNewSkillContainerItem');
        skillImg.src = resourceUI;
        var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
        skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
        util.setImgCssStyle(skillImg, iconData, rate);
        imgContainer.appendChild(skillImg);
        skillDiv.appendChild(imgContainer);
        deadSceneInfoNewSkills.appendChild(skillDiv);

        imgContainer.onmouseover = skillTooltipHandler.bind(imgContainer);
        imgContainer.onmouseout = bottomTooltipOffHandler.bind(imgContainer);

        setTimeout(function() {
          skillDiv.style.opacity = 1;
        }, 100);

        beforeGameNewSkills.splice(0, 1);
        setTimeout(playNewSkillAni, 200);
      } else {
         onCompleteSkillAni();
      }
    }

    function onCompleteSkillAni() {
      // show confirm button
      deadSceneConfirm.classList.remove('deadSceneDefault');
      deadSceneConfirm.classList.add('deadSceneAni');

      deadSceneConfirm.onclick = new Function();
      deadSceneConfirm.addEventListener('click', function() {
        self.onDeadSceneConfirmClick();

        // clear all texts skills levels
        deadSceneTextContainer.classList.add('deadSceneDefault');
        deadSceneTextContainer.classList.remove('deadSceneAni');
        deadSceneText.classList.add('deadSceneDefault');
        deadSceneText.classList.remove('deadSceneAni');
        deadSceneInfoContainer.classList.add('deadSceneDefault');
        deadSceneInfoContainer.classList.remove('deadSceneAni');
        deadSceneMid.classList.add('deadSceneDefault');
        deadSceneMid.classList.remove('deadSceneAni');
        deadSceneBottom.classList.add('deadSceneDefault');
        deadSceneBottom.classList.remove('deadSceneAni');
        deadSceneConfirm.classList.add('deadSceneDefault');
        deadSceneConfirm.classList.remove('deadSceneAni');

        baseSkillLevel.classList.remove('yellow');
        basePassiveSkillLevel.classList.remove('yellow');
        deadSceneInfoGold.classList.remove('yellow');
        deadSceneInfoJewel.classList.remove('yellow');

        while(deadSceneInfoNewSkills.firstChild) {
          deadSceneInfoNewSkills.removeChild(deadSceneInfoNewSkills.firstChild);
        }
      });
    }
    // var levelText = "";
    // switch (characterType) {
    //   case gameConfig.CHAR_TYPE_FIRE:
    //       levelText += "<span class='yellow'>Lv " + currentLevel + " </span><span class='red'>" + fireCharName + "</span>";
    //     break;
    //   case gameConfig.CHAR_TYPE_FROST:
    //       levelText += "<span class='yellow'>Lv " + currentLevel + " </span><span class='blue'>" + frostCharName + "</span>";
    //     break;
    //   case gameConfig.CHAR_TYPE_ARCANE:
    //       levelText += "<span class='yellow'>Lv " + currentLevel + " </span><span class='purple'>" + arcaneCharName + "</span>";
    //     break;
    //   default:
    // }
    // deadSceneToLevel.innerHTML = levelText;
  },
  disableDeadScene : function() {

    // deadSceneText.innerHTML = '';
    deadSceneBackground.classList.remove('deadSceneBackgroundAni');
    deadSceneBackground.classList.add('deadSceneBackgroundDefault');
    // deadSceneTextContainer.classList.remove('deadSceneAni');
    // deadSceneTextContainer.classList.add('deadSceneDefault');
    gameSceneDeadScene.style.width = "0%";
    gameSceneDeadScene.style.height = "0%";
    gameSceneDeadScene.style.pointerEvents = 'none';

    gameScene.classList.add('disappearSmoothAni');
    gameScene.classList.remove('enable');
    setTimeout(function(){
      gameScene.classList.add('disable');
      gameScene.classList.remove('disappearSmoothAni');
    }, 1000);
  },
  bottomToRight : function(){
    gameSceneHudBottomRightCenter.classList.add('bottomRightCenterToRight');
  },
  rightToBottom : function(){
    gameSceneHudBottomRightCenter.classList.remove('bottomRightCenterToRight');
  },
  playReconnectScene : function(){
    reconnectScene.classList.remove('disable');
    reconnectTextTimeout = setTimeout(reconnectTextHandler, 500);
    function reconnectTextHandler(){
      var output = "connecting";
      switch (reconnectTextDotCount) {
        case 1:
        output += ".";
        break;
        case 2:
        output += "..";
        break;
        case 3:
        output += "...";
        break;
      }
      reconnectTextDotCount ++;
      if(reconnectTextDotCount > 3){
        reconnectTextDotCount = 1;
      }
      reconnectMessage.innerHTML = output;
      reconnectTextTimeout = setTimeout(reconnectTextHandler, 500);
    }
  },
  updateKeySettings : function(keySettings){
    bindE.placeholder = util.keyCodeToChar(keySettings['BindingE']);
    bindSpace.placeholder = util.keyCodeToChar(keySettings['BindingSpace']);
    bindA.placeholder = util.keyCodeToChar(keySettings['BindingA']);
    bind1.placeholder = util.keyCodeToChar(keySettings['Binding1']);
    bind2.placeholder = util.keyCodeToChar(keySettings['Binding2']);
    bind3.placeholder = util.keyCodeToChar(keySettings['Binding3']);
    bind4.placeholder = util.keyCodeToChar(keySettings['Binding4']);
    bindS.placeholder = util.keyCodeToChar(keySettings['BindingS']);
    bindG.placeholder = util.keyCodeToChar(keySettings['BindingG']);
    // bindHome.placeholder = util.keyCodeToChar(keySettings['BindingHome']);
  },
  resetKeySettings : function(){
    keySettings['BindingE'] = originKeySettings['BindingE'];
    keySettings['BindingSpace'] = originKeySettings['BindingSpace'];
    keySettings['BindingA'] = originKeySettings['BindingA'];
    keySettings['Binding1'] = originKeySettings['Binding1'];
    keySettings['Binding2'] = originKeySettings['Binding2'];
    keySettings['Binding3'] = originKeySettings['Binding3'];
    keySettings['Binding4'] = originKeySettings['Binding4'];
    keySettings['BindingS'] = originKeySettings['BindingS'];
    keySettings['BindingG'] = originKeySettings['BindingG'];
    // keySettings['BindingHome'] = originKeySettings['BindingHome'];
    keySettings['BindingEnter'] = originKeySettings['BindingEnter'];
    keySettings['BindingEsc'] = originKeySettings['BindingEsc'];

    this.updateKeySettings(keySettings);
  },
  disableReconnectScene : function(){
    if(reconnectTextTimeout){
      clearTimeout(reconnectTextTimeout);
    }
    reconnectScene.classList.add('disable');
  },
  disableDisplayAd : function(){
    displayContainer.classList.add('disable');
  },
  enableDisplayAd : function(){
    displayContainer.classList.remove('disable');
  },
  checkVideoAd : function(charType, btn){
    if(videoAdComplete){
      this.onStartBtnClick(charType, btn);
    }else{
      var self = this;
      setTimeout(function(){
        self.checkVideoAd.call(self, charType, btn)
      }, 200);
    }
  },
  clearTutorial: function() {
    isClearTutorial = true;
    newSkills = [];
    var imgs = document.getElementById('popUpSkillContainer').getElementsByTagName('img');
    for (var i=0; i<imgs.length; i += 2) {
      imgs[i].classList.add('disable');
    }
    var imgTags = document.getElementById('hudBtnSkillChange').parentNode.getElementsByTagName('img');
    imgTags[0].classList.add('disable');
    var standingSceneImgTags = document.getElementById('standingSceneSkillSettingBtn').getElementsByTagName('img');
    standingSceneImgTags[0].classList.add('disable');
  }
};
function popChange(popWindow, isCenter){
  if(popWindow.classList.contains('disable')){
    popWindow.classList.add('enable');
    popWindow.classList.remove('disable');
    if(isCenter){
      popWindow.classList.add('popToCenter');

      popUpBackground.classList.add('enable');
      popUpBackground.classList.remove('disable');
    }else{
      popWindow.classList.remove('popToCenter');
    }
  }else if(popWindow.classList.contains('enable')){
    popWindow.classList.add('disable');
    popWindow.classList.remove('enable');

    popWindow.classList.remove('popToCenter');
    popUpBackground.classList.add('disable')
    popUpBackground.classList.remove('enable');
  }
};
function changeEquipSkillHandler(selectDiv, selectPanel, dontUpdateEquip){
  //clear selected and equipable class
  // if(selectedDiv){
  //   selectedDiv.classList.remove('selected');
  // }
  // popUpEquipSkill1.classList.remove('equipable');
  // popUpEquipSkill2.classList.remove('equipable');
  // popUpEquipSkill3.classList.remove('equipable');
  // popUpEquipSkill4.classList.remove('equipable');
  //
  // for(var i=0; i<popUpSkillContainer.children.length; i++){
  //   popUpSkillContainer.children[i].classList.remove('equipable');
  // }
  this.onPopUpSkillChangeClick();
  clearPopSkillChangeClass();
  var selectEquipIndex = null;
  var rate = 75 / 72;
  var equipSlot = null;

  if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_EQUIP){
    //set selectedEquipIndex
    if(selectDiv === popUpEquipBaseSkill){
      selectEquipIndex = -1;
    }else if(selectDiv === popUpEquipSkill1){
      selectEquipIndex = 0;
    }else if(selectDiv === popUpEquipSkill2){
      selectEquipIndex = 1;
    }else if(selectDiv === popUpEquipSkill3){
      selectEquipIndex = 2;
    }else if(selectDiv === popUpEquipSkill4){
      selectEquipIndex = 3;
    }else if(selectDiv === popUpEquipPassiveSkill){
      selectEquipIndex = -1;
    }
  }
  //update new skills
  var skillIndex = parseInt(selectDiv.getAttribute('skillIndex'));
  if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_CONTAINER){
    var index = newSkills.indexOf(skillIndex);
    if(index !== -1){
      newSkills.splice(index, 1);
    }
    selectDiv.getElementsByTagName('img')[0].classList.add('disable');

    var imgTags = hudBtnSkillChange.parentNode.getElementsByTagName('img');
    imgTags[0].classList.add('disable');
    var standingSceneImgTags = standingSceneSkillSettingBtn.getElementsByTagName('img');
    standingSceneImgTags[0].classList.add('disable');
    if(newSkills.length){
      imgTags[0].classList.remove('disable');
      standingSceneImgTags[0].classList.remove('disable');
    }
  }
  if(selectedPanel){
    if(selectedPanel !== selectPanel){
      //exchange
      if(selectedPanel === gameConfig.SKILL_CHANGE_PANEL_CONTAINER){
        //find skill in container
        //selected === equipSkill selectDiv === container skill
        if(selectEquipIndex === -1){
          this.makeFlashMessage('Can not change character spell!!!');
          // alert('cant change base skill');
        }else{
          var nodeIndex = 0;
          for(var i=0; i<popUpSkillContainer.childNodes.length; i++){
            if(popUpSkillContainer.childNodes[i] === selectedDiv){
              nodeIndex = i;
              break;
            }
          }
          popUpSkillContainer.removeChild(selectedDiv);
          if(skillIndex){
            var beforeSkillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));
            var skillDiv = document.createElement('div');
            var imgContainer = document.createElement('div');
            imgContainer.classList.add('popUpskillImgContainer');
            var skillImg = document.createElement('img');
            skillDiv.setAttribute('skillIndex', skillIndex);

            var newImg = document.createElement('img');
            newImg.classList.add('disable');
            skillDiv.appendChild(newImg);

            skillDiv.classList.add('popUpSkillContainerItem');
            // skillImg.src = beforeSkillData.skillIcon;
            skillImg.src = resourceUI;
            var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', beforeSkillData.skillIcon));
            skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
            util.setImgCssStyle(skillImg, iconData, rate);

            imgContainer.appendChild(skillImg);
            skillDiv.appendChild(imgContainer);

            popUpSkillContainer.insertBefore(skillDiv, popUpSkillContainer.childNodes[nodeIndex]);
            // popUpSkillContainer.appendChild(skillDiv);

            skillDiv.onclick = changeEquipSkillHandler.bind(this, skillDiv, gameConfig.SKILL_CHANGE_PANEL_CONTAINER, dontUpdateEquip);
          }

          while (selectDiv.firstChild) {
            selectDiv.removeChild(selectDiv.firstChild);
          }
          equipSlot = convertEquipIndexToEnum(selectEquipIndex);

          //data change
          equipSkills.splice(selectEquipIndex, 1);
          equipSkillDatas.splice(selectEquipIndex, 1);

          equipSkills.splice(selectEquipIndex, 0, selectedSkillIndex);
          var skillData = objectAssign({}, util.findData(skillTable, 'index', selectedSkillIndex));
          equipSkillDatas.splice(selectEquipIndex, 0, skillData);

          var imgContainer = document.createElement('div');
          imgContainer.classList.add('popUpskillImgContainer');

          var skillImg = document.createElement('img');
          // skillImg.src = skillData.skillIcon;
          skillImg.src = resourceUI;
          var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
          skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
          util.setImgCssStyle(skillImg, iconData, rate);

          selectDiv.setAttribute('skillIndex', skillData.index);
          imgContainer.appendChild(skillImg);
          selectDiv.appendChild(imgContainer);
          this.applySkillCooldown(skillData.index, selectEquipIndex);
        }
      }else{
        if(selectedEquipIndex === -1){
          this.makeFlashMessage('Can not change character spell!!!');
          // alert('cant change base skill');
        }else{
          var nodeIndex = 0;
          for(var i=0; i<popUpSkillContainer.childNodes.length; i++){
            if(popUpSkillContainer.childNodes[i] === selectDiv){
              nodeIndex = i;
              break;
            }
          }
          popUpSkillContainer.removeChild(selectDiv);
          if(selectedSkillIndex){
            var beforeSkillData = objectAssign({}, util.findData(skillTable, 'index', selectedSkillIndex));
            var skillDiv = document.createElement('div');
            var imgContainer = document.createElement('div');
            imgContainer.classList.add('popUpskillImgContainer');
            var skillImg = document.createElement('img');

            var newImg = document.createElement('img');
            newImg.classList.add('disable');
            skillDiv.appendChild(newImg);

            skillDiv.setAttribute('skillIndex', selectedSkillIndex);

            skillDiv.classList.add('popUpSkillContainerItem');
            // skillImg.src = beforeSkillData.skillIcon;
            skillImg.src = resourceUI;
            var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', beforeSkillData.skillIcon));
            skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
            util.setImgCssStyle(skillImg, iconData, rate);

            imgContainer.appendChild(skillImg);
            skillDiv.appendChild(imgContainer);
            popUpSkillContainer.insertBefore(skillDiv, popUpSkillContainer.childNodes[nodeIndex]);
            // popUpSkillContainer.appendChild(skillDiv);

            skillDiv.onclick = changeEquipSkillHandler.bind(this, skillDiv, gameConfig.SKILL_CHANGE_PANEL_CONTAINER, dontUpdateEquip);
          }

          while (selectedDiv.firstChild) {
            selectedDiv.removeChild(selectedDiv.firstChild);
          }
          equipSlot = convertEquipIndexToEnum(selectedEquipIndex);
          //data change
          equipSkills.splice(selectedEquipIndex, 1);
          equipSkillDatas.splice(selectedEquipIndex, 1);

          equipSkills.splice(selectedEquipIndex, 0, skillIndex);
          var skillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));
          equipSkillDatas.splice(selectedEquipIndex, 0, skillData);

          var imgContainer = document.createElement('div');
          imgContainer.classList.add('popUpskillImgContainer');

          var skillImg = document.createElement('img');
          // skillImg.src = skillData.skillIcon;
          skillImg.src = resourceUI;
          var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
          skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
          util.setImgCssStyle(skillImg, iconData, rate);

          selectedDiv.setAttribute('skillIndex', skillData.index);
          imgContainer.appendChild(skillImg);
          selectedDiv.appendChild(imgContainer);
          this.applySkillCooldown(skillData.index, selectedEquipIndex);
        }
      }
      this.onExchangeSkill(characterType);
      //set equipSkills
      if(!dontUpdateEquip){
        var slotCooldown = checkSlotCooldown(equipSlot);
        if(skillData && beforeSkillData){
          if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE && beforeSkillData.type === gameConfig.SKILL_TYPE_PASSIVE){
            var beforeBuffIndex = objectAssign({}, util.findData(skillTable, 'index', beforeSkillData.index)).buffToSelf;
            var afterBuffIndex = objectAssign({}, util.findData(skillTable, 'index', skillData.index)).buffToSelf;
            if(!slotCooldown){
              this.onExchangePassive(beforeBuffIndex, afterBuffIndex);
            }else{
              if(isStandbyEquipPassive(beforeBuffIndex)){
                deleteStandbyEquipPassive(beforeBuffIndex);
                addStandbyEquipPassive(afterBuffIndex);
                setTimeout(delayedEquipPassiveHandler.bind(this.onEquipPassive, afterBuffIndex), slotCooldown);
              }else{
                this.onUnequipPassive(beforeBuffIndex);
                addStandbyEquipPassive(afterBuffIndex);
                setTimeout(delayedEquipPassiveHandler.bind(this.onEquipPassive, afterBuffIndex), slotCooldown);
              }
            }
          }else if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE){
            var buffIndex = objectAssign({}, util.findData(skillTable, 'index', skillData.index)).buffToSelf;
            if(!slotCooldown){
              this.onEquipPassive(buffIndex);
            }else{
              addStandbyEquipPassive(buffIndex);
              setTimeout(delayedEquipPassiveHandler.bind(this.onEquipPassive, buffIndex), slotCooldown);
            }
          }else if(beforeSkillData.type === gameConfig.SKILL_TYPE_PASSIVE){
            buffIndex = objectAssign({}, util.findData(skillTable, 'index', beforeSkillData.index)).buffToSelf;
            if(!slotCooldown){
              this.onUnequipPassive(buffIndex);
            }else{
              if(isStandbyEquipPassive(buffIndex)){
                deleteStandbyEquipPassive(buffIndex);
              }else{
                this.onUnequipPassive(buffIndex);
              }
            }
          }
        }else if(skillData){
          if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE){
            buffIndex = objectAssign({}, util.findData(skillTable, 'index', skillData.index)).buffToSelf;
            if(!slotCooldown){
              this.onEquipPassive(buffIndex);
            }else{
              addStandbyEquipPassive(buffIndex);
              setTimeout(delayedEquipPassiveHandler.bind(this.onEquipPassive, buffIndex), slotCooldown);
            }
          }
        }else if(beforeSkillData){
          if(beforeSkillData.type === gameConfig.SKILL_TYPE_PASSIVE){
            buffIndex = objectAssign({}, util.findData(skillTable, 'index', beforeSkillData.index)).buffToSelf;
            if(!slotCooldown){
              this.onUnequipPassive(buffIndex);
            }else{
              if(isStandbyEquipPassive(buffIndex)){
                deleteStandbyEquipPassive(buffIndex);
              }else{
                this.onUnequipPassive(buffIndex);
              }
            }
          }
        }
      }

      this.setHUDSkills();
      updateCharInfoSelectedPanelSkillImage();

      selectedSkillIndex = null;
      selectedPanel = null;
      selectedDiv = null;
      selectedEquipIndex = null;

    }else if(skillIndex === selectedSkillIndex){
      //if click same icon
      if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_EQUIP && selectEquipIndex !== -1){
        var skillData = objectAssign({}, util.findData(skillTable, 'index', selectedSkillIndex));
        var skillDiv = document.createElement('div');
        var imgContainer = document.createElement('div');
        imgContainer.classList.add('popUpskillImgContainer');
        var skillImg = document.createElement('img');

        var newImg = document.createElement('img');
        newImg.classList.add('disable');
        skillDiv.appendChild(newImg);

        skillDiv.setAttribute('skillIndex', selectedSkillIndex);

        skillDiv.classList.add('popUpSkillContainerItem');
        // skillImg.src = skillData.skillIcon;
        skillImg.src = resourceUI;
        var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
        skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
        util.setImgCssStyle(skillImg, iconData, rate);

        imgContainer.appendChild(skillImg);
        skillDiv.appendChild(imgContainer);
        popUpSkillContainer.appendChild(skillDiv);

        skillDiv.onclick = changeEquipSkillHandler.bind(this, skillDiv, gameConfig.SKILL_CHANGE_PANEL_CONTAINER, dontUpdateEquip);

        while (selectedDiv.firstChild) {
          selectedDiv.removeChild(selectedDiv.firstChild);
          selectedDiv.setAttribute('skillIndex', '');
        }

        //data delete
        if(equipSkills[selectedEquipIndex]){
          equipSkills.splice(selectedEquipIndex, 1);
          equipSkillDatas.splice(selectedEquipIndex, 1);
        }
        equipSkills.splice(selectedEquipIndex, 0, undefined);
        equipSkillDatas.splice(selectedEquipIndex, 0, undefined);

        this.onExchangeSkill(characterType);
        this.updateUnEquipSkillSlotCooldown(selectedEquipIndex);

        if(skillData.type === gameConfig.SKILL_TYPE_PASSIVE){
          var buffIndex = objectAssign({}, util.findData(skillTable, 'index', skillData.index)).buffToSelf;
          equipSlot = convertEquipIndexToEnum(selectedEquipIndex);
          var slotCooldown = checkSlotCooldown(equipSlot);
          if(!slotCooldown){
            this.onUnequipPassive(buffIndex);
          }else{
            if(isStandbyEquipPassive(buffIndex)){
              deleteStandbyEquipPassive(buffIndex);
            }else{
              this.onUnequipPassive(buffIndex);
            }
          }
        }
      }

      this.setHUDSkills();
      updateCharInfoSelectedPanelSkillImage();

      selectedSkillIndex = null;
      selectedPanel = null;
      selectedDiv = null;
      selectedEquipIndex = null;
    }else if(selectedDiv === selectDiv){
      clearSelectedPanel();
    }else{
      selectedSkillIndex = skillIndex ? skillIndex : null;
      selectedPanel = selectPanel;
      selectedDiv = selectDiv;
      selectedEquipIndex = selectEquipIndex;

      selectDiv.classList.add('selected');
      if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_CONTAINER){
        popUpEquipSkill1.classList.add('equipable');
        popUpEquipSkill2.classList.add('equipable');
        popUpEquipSkill3.classList.add('equipable');
        popUpEquipSkill4.classList.add('equipable');
      }else if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_EQUIP){
        if(selectEquipIndex !== -1){
          for(var i=0; i<popUpSkillContainer.children.length; i++){
            popUpSkillContainer.children[i].classList.add('equipable');
          }
        }
      }
    }
  }else{
    selectedSkillIndex = skillIndex ? skillIndex : null;
    selectedPanel = selectPanel;
    selectedDiv = selectDiv;
    selectedEquipIndex = selectEquipIndex;

    selectDiv.classList.add('selected');
    if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_CONTAINER){
      popUpEquipSkill1.classList.add('equipable');
      popUpEquipSkill2.classList.add('equipable');
      popUpEquipSkill3.classList.add('equipable');
      popUpEquipSkill4.classList.add('equipable');
    }else if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_EQUIP){
      switch (selectEquipIndex) {
        case -1:
          //case base or inherentPassiveSkill
          break;
        default:
          for(var i=0; i<popUpSkillContainer.children.length; i++){
            popUpSkillContainer.children[i].classList.add('equipable');
          }
      }
    }
  }
  if(this.checkPopUpSkillChange()){
    this.setPopUpSkillChange(dontUpdateEquip);
    selectedSkillIndex = null;
    selectedPanel = null;
    selectedDiv = null;
    selectedEquipIndex = null;
    clearPopSkillChangeClass();
    this.updateSelectedPanel();
  }else{
    this.updateSelectedPanel(selectedSkillIndex);
    if(selectPanel === gameConfig.SKILL_CHANGE_PANEL_EQUIP && !skillIndex && selectDiv.classList.contains('selected')){
      popUpCancelSkillSelectBtn.classList.remove('disable');
    }
  }
  this.checkSkillsConditions();
  if(!isClearTutorial){
    // for(var i=0; i<equipSkills.length; i++){
    var equipSkillsLength = 0;
    for(var i=0; i<equipSkills.length; i++){
      if(equipSkills[i]){
        equipSkillsLength++;
      }
    }
    if(equipSkillsLength >= 2){
    // if(equipSkills[i]===gameConfig.TUTORIAL_SKILL_INDEX){
      isClearTutorial = true;
    }else if(equipSkills[0] !== gameConfig.SKILL_INDEX_PYRO_GIVEN && equipSkills[0] !== gameConfig.SKILL_INDEX_FROST_GIVEN &&
             equipSkills[0] !== gameConfig.SKILL_INDEX_ARCANE_GIVEN){
      isClearTutorial = true;
    }
    // }
  }
};
function skillUpgradeBtnHandler(skillData){
  if(isServerResponse){
    if(selectedSkillIndex){
      //check resource
      if(skillData.nextSkillIndex !== -1){
        var goldAmount = parseInt(goldContainer.innerText);
        var jewelAmount = parseInt(jewelContainer.innerText);
        if(goldAmount >= skillData.upgradeGoldAmount && jewelAmount >= skillData.upgradeJewelAmount){
          this.onSkillUpgrade(selectedSkillIndex);
          isServerResponse = false;
          popUpSkillUpgradeBtn.getElementsByTagName('span')[0].classList.add('disable');
          popUpSkillUpgradeBtn.getElementsByTagName('img')[0].classList.remove('disable');
          this.serverResponseTimeout = setTimeout(function(){
            if(!isServerResponse){
              isServerResponse = true;
              popUpSkillUpgradeBtn.getElementsByTagName('span')[0].classList.remove('disable');
              popUpSkillUpgradeBtn.getElementsByTagName('img')[0].classList.add('disable');
            }
          }, gameConfig.MAX_SERVER_RESPONSE_TIME);
        }else{
          this.makeFlashMessage('Not enough resource!!!');
          // alert('need more resource');
        }
      }else{
        this.makeFlashMessage('Spell reach max level!!!');
      }
    }
  }
};
function startBtnClickHandler(button){
  if(button === startButton){
    var clickButton = gameConfig.START_BUTTON;
  }else if(button === restartButton){
    clickButton = gameConfig.RESTART_BUTTON;
  }
  if(clickButton === gameConfig.RESTART_BUTTON && restartButton.getElementsByTagName('span')[0].classList.contains('disable')){
    //do nothing
  }else{
    if(!videoAdComplete){
      this.disableRestartButton();
      //play video
      // console.log('play Video');
      videoAdPlay.onclick();
      // setTimeout(function(){
      //   adEventHandler();
      // }, 15000);
    }
    this.checkVideoAd(characterType, clickButton);
    // this.onStartBtnClick(characterType, clickButton);
  }
};
function cooldownListener(slot, checkSkillsConditions, e){
  this.classList.remove("cooldownMaskAni");
  this.style.opacity = 0;
  switch (slot) {
    case gameConfig.SKILL_BASIC_INDEX:
      isBaseSkillCooldownOff = true;
      break;
    case gameConfig.SKILL_EQUIP1_INDEX:
      isEquipSkill1CooldownOff = true;
      break;
    case gameConfig.SKILL_EQUIP2_INDEX:
      isEquipSkill2CooldownOff = true;
      break;
    case gameConfig.SKILL_EQUIP3_INDEX:
      isEquipSkill3CooldownOff = true;
      break;
    case gameConfig.SKILL_EQUIP4_INDEX:
      isEquipSkill4CooldownOff = true;
      break;
    default:
  }
  for(var i=0; i<cooldownSkills.length; i++){
    if(cooldownSkills[i].slot === slot){
      cooldownSkills.splice(i, 1);
      break;
    }
  }
  checkSkillsConditions();
};
function clearSelectedPanel(){
  while(popUpSkillInfoIcon.firstChild){
    popUpSkillInfoIcon.removeChild(popUpSkillInfoIcon.firstChild);
  }
  while(popUpSkillInfoDesc.firstChild){
    popUpSkillInfoDesc.removeChild(popUpSkillInfoDesc.firstChild);
  }

  popUpSkillUpgradeCostGold.innerHTML = "";
  popUpSkillUpgradeCostJewel.innerHTML = "";

  selectedSkillIndex = null;
  popUpSkillUpgradeBtn.onclick = new Function();

  selectedPanel = null;
  selectedDiv = null;
  selectedEquipIndex = null;

  popUpSkillUpgradeBtn.getElementsByTagName('span')[0].innerHTML = " ";
  skillUpgradeBlockMask.classList.remove('disable');
  popUpCancelSkillSelectBtn.classList.add('disable');
  skillUpgradeEffect.classList.remove('skillUpgradeEffectAni');

  clearPopSkillChangeClass();
};
function clearPopSkillChangeClass(){
  popUpEquipBaseSkill.classList.remove('selected');
  popUpEquipPassiveSkill.classList.remove('selected');
  popUpEquipSkill1.classList.remove('selected');
  popUpEquipSkill2.classList.remove('selected');
  popUpEquipSkill3.classList.remove('selected');
  popUpEquipSkill4.classList.remove('selected');

  popUpEquipSkill1.classList.remove('equipable');
  popUpEquipSkill2.classList.remove('equipable');
  popUpEquipSkill3.classList.remove('equipable');
  popUpEquipSkill4.classList.remove('equipable');

  for(var i=0; i<popUpSkillContainer.children.length; i++){
    popUpSkillContainer.children[i].classList.remove('equipable');
    popUpSkillContainer.children[i].classList.remove('selected');
  }
};
function bottomSkillTooltipOnHandler(slot){
  switch (slot) {
    case gameConfig.SKILL_BASIC_INDEX:
      if(baseSkillData){
        var skillData = baseSkillData;
      }
      break;
    case gameConfig.SKILL_EQUIP1_INDEX:
      if(equipSkillDatas[0]){
        skillData = equipSkillDatas[0];
      }
      break;
    case gameConfig.SKILL_EQUIP2_INDEX:
      if(equipSkillDatas[1]){
        skillData = equipSkillDatas[1];
      }
      break;
    case gameConfig.SKILL_EQUIP3_INDEX:
      if(equipSkillDatas[2]){
        skillData = equipSkillDatas[2];
      }
      break;
    case gameConfig.SKILL_EQUIP4_INDEX:
      if(equipSkillDatas[3]){
        skillData = equipSkillDatas[3];
      }
      break;
    case gameConfig.SKILL_PASSIVE_INDEX:
      if(inherentPassiveSkillData){
        skillData = inherentPassiveSkillData;
      }
      break;
    default:
  }
  if(skillData){
    var output = makeSkillTooltipString(skillData).replace(/&nbsp;/g, '<br>');

    var tooltipDiv = document.createElement('div');
    tooltipDiv.innerHTML = output;
    tooltipDiv.classList.add('bottomTooltip');

    var parentDiv = this.parentNode.parentNode;
    parentDiv.appendChild(tooltipDiv);
  }
};
function bottomSkillTooltipOffHandler(){
  var parentDiv = this.parentNode.parentNode;
  var tooltipDivs = parentDiv.getElementsByClassName('bottomTooltip');
  for(var i=0; tooltipDivs.length; i++){
    parentDiv.removeChild(tooltipDivs[i]);
  }
};
function skillTooltipHandler(){
  var skillIndex = parseInt(this.getAttribute('skillIndex'));
  if(skillIndex && util.isNumeric(skillIndex)){
    var skillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));

    var output = makeSkillTooltipString(skillData).replace(/&nbsp;/g, '<br>');

    var tooltipDiv = document.createElement('div');
    tooltipDiv.innerHTML = output;
    tooltipDiv.classList.add('bottomTooltip');

    this.appendChild(tooltipDiv);
  }
};
function statTooltipOnHandler(type, stat){
  var tooltipDiv = document.createElement('div');
  var output = "";
  switch (type) {
    case gameConfig.STAT_POWER_INDEX:
      var damageRate = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_POWER_TO_DAMAGE_RATE * 100) / 100;
      var HP = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_POWER_TO_HP * 100) / 100;
      var HPRegen = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_POWER_TO_HP_REGEN * 100) / 100;
      output += "Damage Rate <span class='green'>+" + damageRate + "%</span><br>";
      output += "Max HP <span class='green'>+" + HP + "</span><br>";
      output += "HP Regen <span class='green'>+" + HPRegen + "</span><br>";
      break;
    case gameConfig.STAT_MAGIC_INDEX:
      var Resistance = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_MAGIC_TO_RESISTANCE * 100) / 100;
      var MP = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_MAGIC_TO_MP * 100) / 100;
      var MPRegen = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_MAGIC_TO_MP_REGEN * 100) / 100;
      output += "All Resistance <span class='green'>+" + Resistance + "%</span><br>";
      output += "Max MP <span class='green'>+" + MP + "</span><br>";
      output += "MP Regen <span class='green'>+" + MPRegen + "</span><br>";
      break;
    case gameConfig.STAT_SPEED_INDEX:
      var castSpeed = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_SPEED_TO_CAST_SPEED * 100) / 100;
      var cooldownReduceRate = Math.floor(stat * gameConfig.STAT_CALC_FACTOR_SPEED_TO_COOLDOWN_REDUCE_RATE * 100) / 100;
      output += "Casting Speed <span class='green'>+" + castSpeed + "%</span><br>";
      output += "Cooldown Reduce <span class='green'>+" + cooldownReduceRate + "%</span><br>";
      break;
    default:
  }
  tooltipDiv.innerHTML = output;
  tooltipDiv.classList.add('bottomTooltip');
  this.appendChild(tooltipDiv);
};
function offenceDefenceStatOnHandler(type, data){
  var tooltipDiv = document.createElement('div');
  var output = "";
  if(type === gameConfig.STAT_OFFENCE_INDEX){
    output += "<p><strong>All Damage <span class='green'>+" + (Math.floor((data.dR - 100) * 10) / 10) + "%</span></strong></p>";
    output += "<p>Fire Damage <span class='green'>+" + (Math.floor((data.fiDR - 100) * 10) / 10) + "%</span></p>";
    output += "<p>Frost Damage <span class='green'>+" + (Math.floor((data.frDR - 100) * 10) / 10) + "%</span></p>";
    output += "<p>Arcane Damage <span class='green'>+" + (Math.floor((data.acDR - 100) * 10) / 10) + "%</span></p>";
  }else if(type === gameConfig.STAT_DEFENCE_INDEX){
    output += "<p><strong>All Resistance <span class='green'>+" + (Math.floor(data.rA * 10) / 10) + "%</span></strong></p>";
    output += "<p>Fire Resistance <span class='green'>+" + (Math.floor(data.rFi * 10) / 10) + "%</span></p>";
    output += "<p>Frost Resistance <span class='green'>+" + (Math.floor(data.rFr * 10) / 10) + "%</span></p>";
    output += "<p>Arcane Resistance <span class='green'>+" + (Math.floor(data.rAc * 10) / 10) + "%</span></p>";
  }
  tooltipDiv.innerHTML = output;
  tooltipDiv.classList.add('bottomTooltip');
  this.appendChild(tooltipDiv);
};
function buffTooltipOnHandler(){
  var tooltipDiv = document.createElement('div');

  var buffGroupIndex = parseInt(this.getAttribute('buffGroupIndex'));
  var buffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', buffGroupIndex));
  var output = "<h4 class='yellow'>" + buffGroupData.clientName + "</h4><hr>" + buffGroupData.clientDesc.replace(/&nbsp;/g, '<br>');

  tooltipDiv.innerHTML = output;
  tooltipDiv.classList.add('bottomTooltip');

  this.appendChild(tooltipDiv);
};
function bottomTooltipOffHandler(){
  var tooltipDivs = util.getElementsByClassName(this, 'bottomTooltip');
  for(var i=0; i<tooltipDivs.length; i++){
    this.removeChild(tooltipDivs[i]);
  }
};
function onSkillIconClickHandler(skillSlot){
  this.onSkillIconClick(skillSlot);
};
function onSelectSkillCancelBtnClickHandler(){
  this.onSelectSkillCancelBtnClick();
};
// function makeFlashMessage(msg){
//   var message = document.createElement('p');
//   message.innerHTML = msg;
//   message.classList.add('flashMessage');
//   setTimeout(function(){
//     message.classList.add('flashMessageAni');
//   }, 2000);
//   flashMessageContainer.appendChild(message);
//   // centerMessageContainer.insertBefore(messageDiv, centerMessageContainer.childNodes[0]);
//   setTimeout(function(){
//     flashMessageContainer.removeChild(message);
//   }, 5000);
// };
function updateCharInfoSelectedPanelSkillImage(){
  var rate = 40/72;
  var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', baseSkillData.skillIcon));
  standingSceneSelectedCharBaseSkill.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
  standingSceneSelectedCharBaseSkill.setAttribute('skillIndex', baseSkillData.index);
  util.setImgCssStyle(standingSceneSelectedCharBaseSkill.getElementsByTagName('img')[0], iconData, rate);

  iconData = objectAssign({}, util.findData(iconResourceTable, 'index', inherentPassiveSkillData.skillIcon));
  standingSceneSelectedCharPassiveSkill.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
  standingSceneSelectedCharPassiveSkill.setAttribute('skillIndex', inherentPassiveSkillData.index);
  util.setImgCssStyle(standingSceneSelectedCharPassiveSkill.getElementsByTagName('img')[0], iconData, rate);

  rate = 50/72;
  if(equipSkillDatas[0]){
    iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[0].skillIcon));
    standingSceneSelectedCharEquipSkill1.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
    standingSceneSelectedCharEquipSkill1.setAttribute('skillIndex', equipSkillDatas[0].index);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill1.getElementsByTagName('img')[0], iconData, rate);
  }else{
    standingSceneSelectedCharEquipSkill1.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(blankFrameData, rate);
    standingSceneSelectedCharEquipSkill1.setAttribute('skillIndex', 0);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill1.getElementsByTagName('img')[0], blankFrameData, rate);
  }
  if(equipSkillDatas[1]){
    iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[1].skillIcon));
    standingSceneSelectedCharEquipSkill2.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
    standingSceneSelectedCharEquipSkill2.setAttribute('skillIndex', equipSkillDatas[1].index);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill2.getElementsByTagName('img')[0], iconData, rate);
  }else{
    standingSceneSelectedCharEquipSkill2.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(blankFrameData, rate);
    standingSceneSelectedCharEquipSkill2.setAttribute('skillIndex', 0);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill2.getElementsByTagName('img')[0], blankFrameData, rate);
  }
  if(equipSkillDatas[2]){
    iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[2].skillIcon));
    standingSceneSelectedCharEquipSkill3.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
    standingSceneSelectedCharEquipSkill3.setAttribute('skillIndex', equipSkillDatas[2].index);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill3.getElementsByTagName('img')[0], iconData, rate);
  }else{
    standingSceneSelectedCharEquipSkill3.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(blankFrameData, rate);
    standingSceneSelectedCharEquipSkill3.setAttribute('skillIndex', 0);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill3.getElementsByTagName('img')[0], blankFrameData, rate);
  }
  if(equipSkillDatas[3]){
    iconData = objectAssign({}, util.findData(iconResourceTable, 'index', equipSkillDatas[3].skillIcon));
    standingSceneSelectedCharEquipSkill4.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(iconData, rate);
    standingSceneSelectedCharEquipSkill4.setAttribute('skillIndex', equipSkillDatas[3].index);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill4.getElementsByTagName('img')[0], iconData, rate);
  }else{
    standingSceneSelectedCharEquipSkill4.getElementsByTagName('img')[0].style.clip = util.makeCssClipStyle(blankFrameData, rate);
    standingSceneSelectedCharEquipSkill4.setAttribute('skillIndex', 0);
    util.setImgCssStyle(standingSceneSelectedCharEquipSkill4.getElementsByTagName('img')[0], blankFrameData, rate);
  }
};
function makeSkillTooltipString(skillData, nextSkillData){
  var output = "";

  var color = 'white';
  switch (skillData.property) {
    case gameConfig.SKILL_PROPERTY_FIRE:
      color = 'red'
      break;
    case gameConfig.SKILL_PROPERTY_FROST:
      color = 'blue'
      break;
    case gameConfig.SKILL_PROPERTY_ARCANE:
      color = 'purple'
      break;
    default:
  }

  output += "<h4 class='" + color + "'><span class='yellow'>Lv " + skillData.level + "</span> " + skillData.clientName + "</h4><hr>";
  output += "<div class='tierLabel'><span class='green'>Tier : </span>" + skillData.tier + "</span></div>";
  if(skillData.type !== gameConfig.SKILL_TYPE_PASSIVE){
    output += "<div class='titleLabel'><span class='green'>Active</span></div>"
    var dmg = skillData.fireDamage + skillData.frostDamage + skillData.arcaneDamage;
    if(nextSkillData){
      var nextDmg = nextSkillData.fireDamage + nextSkillData.frostDamage + nextSkillData.arcaneDamage;
    }
    switch (skillData.type) {
      case gameConfig.SKILL_TYPE_INSTANT_RANGE:
        if(nextSkillData && nextDmg > dmg){
          output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span><img src='/images/upIcon.png' class='disable' /></div>";
        }else{
          output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span></div>";
        }
        if(nextSkillData && nextSkillData.explosionRadius > skillData.explosionRadius){
          output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "<img src='/images/upIcon.png' class='disable' /></div>";
        }else{
          output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "</div>";
        }
        break;
      // case gameConfig.SKILL_TYPE_INSTANT_PROJECTILE:
      //   output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span></div>";
      //   output += "<div><span class='yellow'>Radius : </span>" + (skillData.radius) + "</div>";
      //   break;
      case gameConfig.SKILL_TYPE_PROJECTILE:
        if(nextSkillData){
          if(nextDmg > dmg){
            output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span><img src='/images/upIcon.png' class='disable' /></div>";
          }else{
            output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span></div>";
          }
          if(nextSkillData.radius > skillData.radius){
            output += "<div><span class='yellow'>Radius : </span>" + (skillData.radius) + "<img src='/images/upIcon.png' class='disable' /></div>";
          }else{
            output += "<div><span class='yellow'>Radius : </span>" + (skillData.radius) + "</div>";
          }
        }else{
          output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span></div>";
          output += "<div><span class='yellow'>Radius : </span>" + (skillData.radius) + "</div>";
        }
        break;
      case gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION:
        if(nextSkillData && nextDmg > dmg){
          output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span><img src='/images/upIcon.png' class='disable' /></div>";
        }else{
          output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span></div>";
        }
        if(nextSkillData && nextSkillData.explosionRadius > skillData.explosionRadius){
          output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "<img src='/images/upIcon.png' class='disable' /></div>";
        }else{
          output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "</div>";
        }
        break;
      case gameConfig.SKILL_TYPE_PROJECTILE_TICK:
        if(nextSkillData){
          if(nextDmg > dmg){
            output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span><img src='/images/upIcon.png' class='disable' /></div>";
          }else{
            output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span></div>";
          }
          if(nextSkillData.radius > skillData.radius){
            output += "<div><span class='yellow'>Radius : </span>" + (skillData.radius) + "<img src='/images/upIcon.png' class='disable' /></div>";
          }else{
            output += "<div><span class='yellow'>Radius : </span>" + (skillData.radius) + "</div>";
          }
        }else{
          output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span></div>";
          output += "<div><span class='yellow'>Radius : </span>" + (skillData.radius) + "</div>";
        }
        break;
      case gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION:
        if(nextSkillData){
          if(nextDmg > dmg){
            output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span><img src='/images/upIcon.png' class='disable' /></div>";
          }else{
            output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span></div>";
          }
          if(nextSkillData.radius > skillData.radius){
            output += "<div><span class='yellow'>Radius : </span>" + (skillData.radius) + "<img src='/images/upIcon.png' class='disable' /></div>";
          }else{
            output += "<div><span class='yellow'>Radius : </span>" + (skillData.radius) + "</div>";
          }
        }else{
          output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span></div>";
          output += "<div><span class='yellow'>Radius : </span>" + (skillData.radius) + "</div>";
        }
        break;
      case gameConfig.SKILL_TYPE_RANGE:
        if(dmg){
          if(nextSkillData && nextDmg > dmg){
            output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span><img src='/images/upIcon.png' class='disable' /></div>";
          }else{
            output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span></div>";
          }
          if(nextSkillData && nextSkillData.explosionRadius > skillData.explosionRadius){
            output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "<img src='/images/upIcon.png' class='disable' /></div>";
          }else{
            output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "</div>";
          }
        }else{
          var buffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', skillData.buffToTarget));
          var duration = Math.floor(buffGroupData.buffLifeTime * 10) / 10000;
          if(nextSkillData){
            var nextBuffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', nextSkillData.buffToTarget));
            var nextDuration = Math.floor(nextBuffGroupData.buffLifeTime * 10) / 10000;
          }
          if(util.isNumeric(duration) && duration >= 1){
            if(nextSkillData){
              if(util.isNumeric(nextDuration) && nextDuration >= 1){
                if(nextDuration > duration){
                  output += "<div><span class='yellow'>Duration : </span>" + duration + "(s)<img src='/images/upIcon.png' class='disable' /></div>";
                }else{
                  output += "<div><span class='yellow'>Duration : </span>" + duration + "(s)</div>";
                }
              }
            }else{
              output += "<div><span class='yellow'>Duration : </span>" + duration + "(s)</div>";
            }
          }
          if(nextSkillData && nextSkillData.explosionRadius > skillData.explosionRadius){
            output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "<img src='/images/upIcon.png' class='disable' /></div>";
          }else{
            output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "</div>";
          }
          if(!util.isNumeric(duration) || duration < 1){
            output += "<div></div>"
          }
        }
        break;
      case gameConfig.SKILL_TYPE_SELF:
        var buffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', skillData.buffToSelf));
        var duration = Math.floor(buffGroupData.buffLifeTime * 10) / 10000;
        if(nextSkillData){
          var nextBuffGroupData = objectAssign({}, util.findData(buffGroupTable, 'index', nextSkillData.buffToSelf));
          var nextDuration = Math.floor(nextBuffGroupData.buffLifeTime * 10) / 10000;
        }
        if(nextSkillData){
          if(isNaN(nextDuration) || nextDuration <=1){
            output += "<div><span class='yellow'>Duration : </span>" + duration + "(s)<img src='/images/upIcon.png' class='disable' /></div>";
            output += "<div></div>"
          }else if(nextDuration > duration){
            output += "<div><span class='yellow'>Duration : </span>" + duration + "(s)<img src='/images/upIcon.png' class='disable' /></div>";
            output += "<div></div>"
          }else{
            output += "<div><span class='yellow'>Duration : </span>" + duration + "(s)</div>";
            output += "<div></div>"
          }
        }else{
          if(isNaN(duration) || duration <= 1){
            // output += "<div></div>"
            // output += "<div></div>"
          }else{
            output += "<div><span class='yellow'>Duration : </span>" + duration + "(s)</div>";
            output += "<div></div>"
          }
        }
        break;
      case gameConfig.SKILL_TYPE_SELF_EXPLOSION:
        if(nextSkillData && nextDmg > dmg){
          output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span><img src='/images/upIcon.png' class='disable' /></div>";
        }else{
          output += "<div><span class='yellow'>Damage : </span>" + "<span class='" + color + "'>" + dmg + "</span></div>";
        }
        if(nextSkillData && nextSkillData.explosionRadius > skillData.explosionRadius){
          output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "<img src='/images/upIcon.png' class='disable' /></div>";
        }else{
          output += "<div><span class='yellow'>Range : </span>" + (skillData.explosionRadius) + "</div>";
        }
        break;
      case gameConfig.SKILL_TYPE_TELEPORT:
        if(nextSkillData && nextSkillData.range > skillData.range){
          output += "<div><span class='yellow'>Range : </span>" + (skillData.range) + "<img src='/images/upIcon.png' class='disable' /></div>";
        }else{
          output += "<div><span class='yellow'>Range : </span>" + (skillData.range) + "</div>";
        }
        output += "<div></div>"
        break;
      default:
    }
    var cooldown = Math.floor(skillData.cooldown * 10) / 10000;
    if(skillData.type !== gameConfig.SKILL_TYPE_INSTANT_RANGE && skillData.type !== gameConfig.SKILL_TYPE_INSTANT_PROJECTILE){
      if(nextSkillData){
        if(nextSkillData.consumeMP > skillData.consumeMP){
          output += "<div><span class='yellow'>MP Cost : </span>" + skillData.consumeMP + "<img src='/images/downIcon.png' class='disable' /></div>";
        }else if(nextSkillData.consumeMP < skillData.consumeMP){
          output += "<div><span class='yellow'>MP Cost : </span>" + skillData.consumeMP + "<img src='/images/upIcon.png' class='disable' /></div>";
        }else{
          output += "<div><span class='yellow'>MP Cost : </span>" + skillData.consumeMP + "</div>";
        }
        if(nextSkillData.cooldown < skillData.cooldown){
          output += "<div><span class='yellow'>Cooldown : </span>" + cooldown + "(s)<img src='/images/upIcon.png' class='disable' /></div>";
        }else{
          output += "<div><span class='yellow'>Cooldown : </span>" + cooldown + "(s)</div>";
        }
      }else{
        output += "<div><span class='yellow'>MP Cost : </span>" + skillData.consumeMP + "</div>";
        output += "<div><span class='yellow'>Cooldown : </span>" + cooldown + "(s)</div>";
      }
    }
    output += "<hr>"
  }else{
    output += "<div class='titleLabel'><span class='green'>Passive</span></div>"
    output += "<div></div><div></div><hr>"
  }
  output += "<p>" + skillData.clientDesc + "</p>";
  return output;
};
function convertEquipIndexToEnum(equipIndex){
  switch (equipIndex) {
    case 0:
      return gameConfig.SKILL_EQUIP1_INDEX;
    case 1:
      return gameConfig.SKILL_EQUIP2_INDEX;
    case 2:
      return gameConfig.SKILL_EQUIP3_INDEX;
    case 3:
      return gameConfig.SKILL_EQUIP4_INDEX;
    default:
  }
};
function checkSlotCooldown(slot){
  var slotCooldown = 0;
  for(var i=0; i<cooldownSkills.length; i++){
    if(slot === cooldownSkills[i].slot){
      var timeDelay = Date.now() - cooldownSkills[i].startTime;
      slotCooldown = cooldownSkills[i].cooldownTime * 1000 - timeDelay;
      break;
    }
  }
  return slotCooldown;
};
function isStandbyEquipPassive(buffIndex){
  for(var i=0; i<standbyEquipPassiveList.length; i++){
    if(standbyEquipPassiveList[i] === buffIndex){
      return true;
    }
  }
  return false;
};
function addStandbyEquipPassive(buffIndex){
  for(var i=standbyEquipPassiveList.length - 1; i>=0; i--){
    if(standbyEquipPassiveList[i] === buffIndex){
      standbyEquipPassiveList.splice(i, 1);
    }
  }
  standbyEquipPassiveList.push(buffIndex);
};
function deleteStandbyEquipPassive(buffIndex){
  var arrayIndex = standbyEquipPassiveList.indexOf(buffIndex);
  if(arrayIndex !== -1){
    standbyEquipPassiveList.splice(arrayIndex, 1);
  }
};
function delayedEquipPassiveHandler(buffIndex){
  for(var i=standbyEquipPassiveList.length - 1; i>=0; i--){
    if(standbyEquipPassiveList[i] === buffIndex){
      standbyEquipPassiveList.splice(i, 1);
      this(buffIndex);
      break;
    }
  }
};
function playPopUpTutorial(){
  if(!isPlayingTutorial){
    isPlayingTutorial = true;
    popUpSkillInfoAndBtn.classList.add('disable');
    popUpSkillTextSkillInfo.classList.add('disable');
    //animate tutorial
    setTimeout(function(){
      if(!isClearTutorial){
        popUpSkillContainer.classList.add('skillEquipTutorialHighlight');
      }else{
        disablePopUpTutorial();
      }
    }, 200);
    setTimeout(function(){
      if(!isClearTutorial){
        popUpSkillTutorialClickText2.classList.add('disable');
        popUpSkillTutorialClickText1.classList.remove('disable');
        popUpSkillTutorialClickText1.classList.add('skillEquipTutorialAni');
      }else{
        disablePopUpTutorial();
      }
    }, 500);
    setTimeout(function(){
      if(!isClearTutorial){
        popUpSkillTutorialClickText1.classList.add('disable');
        popUpSkillTutorialArrow.classList.remove('disable');
        popUpSkillTutorialArrow.classList.add('skillEquipTutorialAni');
        popUpSkillTutorialArrow.style.animationIterationCount = 1;
      }else{
        disablePopUpTutorial();
      }
      popUpSkillContainer.classList.remove('skillEquipTutorialHighlight');
    }, 2500);
    setTimeout(function(){
      if(!isClearTutorial){
        popUpEquipSkillsContainer.classList.add('skillEquipTutorialHighlight');
      }else{
        disablePopUpTutorial();
      }
    }, 3500);
    setTimeout(function(){
      if(!isClearTutorial){
        popUpSkillTutorialClickText2.classList.remove('disable');
        popUpSkillTutorialArrow.classList.add('disable');
        popUpSkillTutorialClickText2.classList.add('skillEquipTutorialAni');
      }else{
        disablePopUpTutorial();
      }
    }, 3800);
    setTimeout(function(){
      popUpEquipSkillsContainer.classList.remove('skillEquipTutorialHighlight');
      isPlayingTutorial = false;
      disablePopUpTutorial();
      if(!isClearTutorial){
        popUpSkillTutorialClickText2.classList.add('disable');
        playPopUpTutorial();
      }
    }, 5800);
  }
};
function disablePopUpTutorial(){
  popUpSkillInfoAndBtn.classList.remove('disable');
  popUpSkillTextSkillInfo.classList.remove('disable');

  popUpSkillContainer.classList.remove('skillEquipTutorialHighlight');
  popUpEquipSkillsContainer.classList.remove('skillEquipTutorialHighlight');
  popUpSkillTutorialClickText1.classList.add('disable');
  popUpSkillTutorialClickText2.classList.add('disable');
  popUpSkillTutorialArrow.classList.add('disable');
};
function setStartNickName() {
  if (_u && _u.n !== '0') {
    var userStartNickName = document.getElementById('userStartNickName');
    userStartNickName.value = _u.n;
  }
}
function setStartSceneCharIconClick(pyro, froster, myster){
  var children = document.getElementById('startSceneHudCenterCenterCharSelect').children;
  for(var i=0; i<children.length; i++){
    children[i].onclick = function(){
      var type = parseInt(this.getAttribute('type'));
      if(type === gameConfig.CHAR_TYPE_FIRE || type === gameConfig.CHAR_TYPE_FROST || type === gameConfig.CHAR_TYPE_ARCANE){
        characterType = type;
      }else{
        characterType = gameConfig.CHAR_TYPE_FIRE;
      }
      for(var j=0; j<children.length; j++){
        children[j].classList.remove('selectedChar');
      }
      this.classList.add('selectedChar');

      //updateSelectedPanel
      var name = "";
      var desc = "";
      var color = "";
      var level = 1;
      switch (type) {
        case gameConfig.CHAR_TYPE_FIRE:
          name = fireCharName;
          desc = fireCharDesc;
          color = "red";
          level = pyro;
          break;
        case gameConfig.CHAR_TYPE_FROST:
          name = frostCharName;
          desc = frostCharDesc;
          color = "blue";
          level = froster;
          break;
        case gameConfig.CHAR_TYPE_ARCANE:
          name = arcaneCharName;
          desc = arcaneCharDesc;
          color = "purple";
          level = myster;
          break;
        default:
      }
      var statData = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', characterType, 'level', level));
      startSceneSelectedCharName.innerHTML = "<span class='" + color + "'>" + name + "</span>";
      startSceneSelectedCharDesc.innerHTML = desc;
      startSceneSelectedCharStatPower.getElementsByTagName('span')[0].innerHTML = statData.power;
      startSceneSelectedCharStatMagic.getElementsByTagName('span')[0].innerHTML = statData.magic;
      startSceneSelectedCharStatSpeed.getElementsByTagName('span')[0].innerHTML = statData.speed;

      startSceneSelectedCharStatPower.onmouseover = statTooltipOnHandler.bind(startSceneSelectedCharStatPower, gameConfig.STAT_POWER_INDEX, statData.power);
      startSceneSelectedCharStatPower.onmouseout = bottomTooltipOffHandler.bind(startSceneSelectedCharStatPower);

      startSceneSelectedCharStatMagic.onmouseover = statTooltipOnHandler.bind(startSceneSelectedCharStatMagic, gameConfig.STAT_MAGIC_INDEX, statData.magic);
      startSceneSelectedCharStatMagic.onmouseout = bottomTooltipOffHandler.bind(startSceneSelectedCharStatMagic);

      startSceneSelectedCharStatSpeed.onmouseover = statTooltipOnHandler.bind(startSceneSelectedCharStatSpeed, gameConfig.STAT_SPEED_INDEX, statData.speed);
      startSceneSelectedCharStatSpeed.onmouseout = bottomTooltipOffHandler.bind(startSceneSelectedCharStatSpeed);
    };
  }
  children[0].onclick();
};
function popUpSortTypeClickHandler(){
  var type = parseInt(popUpSortType.getAttribute('sortType'));
  if(type){
    switch (type) {
      case gameConfig.CHAR_TYPE_FIRE:
        popUpSortType.setAttribute('sortType', gameConfig.CHAR_TYPE_FROST);
        popUpSortType.src = '/images/charFrostSymbol.png';
        break;
      case gameConfig.CHAR_TYPE_FROST:
        popUpSortType.setAttribute('sortType', gameConfig.CHAR_TYPE_ARCANE);
        popUpSortType.src = '/images/charArcaneSymbol.png';
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        popUpSortType.setAttribute('sortType', gameConfig.CHAR_TYPE_FIRE);
        popUpSortType.src = '/images/charFireSymbol.png';
        break;
    }
  }else{
    popUpSortType.setAttribute('sortType', gameConfig.CHAR_TYPE_FIRE);
    popUpSortType.src = '/images/charArcaneSymbol.png';
  }
  popUpSortBtn.onclick();
};
function popUpSortBtnClickHandler(dontUpdateEquip){
  var type = parseInt(popUpSortType.getAttribute('sortType'));
  // possessSkills.sort();
  if(!type){
    type = gameConfig.CHAR_TYPE_FIRE;
  }
  var typeSkillList = [];
  var otherSkillList = [];
  for(var i=0; i<possessSkills.length; i++){
    var skillData = objectAssign({}, util.findData(skillTable, 'index', possessSkills[i]));
    if(skillData.property === type){
      typeSkillList.push(possessSkills[i]);
    }else{
      otherSkillList.push(possessSkills[i]);
    }
  }
  typeSkillList.sort(function(a, b){
    return a - b;
  });
  otherSkillList.sort(function(a, b){
    return a - b;
  });
  possessSkills = [];
  for(var i=0; i<typeSkillList.length; i++){
    possessSkills.push(typeSkillList[i]);
  }
  for(var i=0; i<otherSkillList.length; i++){
    possessSkills.push(otherSkillList[i]);
  }
  while (popUpSkillContainer.firstChild) {
    popUpSkillContainer.removeChild(popUpSkillContainer.firstChild);
  }

  var equipSkillIndexes = [];
  // equipSkillIndexes.push(baseSkill);
  for(var i=0; i<equipSkills.length; i++){
    equipSkillIndexes.push(equipSkills[i]);
  }

  var rate = 75 / 72;
  for(var i=0; i<possessSkills.length; i++){
    var isEquipSkill = false;
    // if(equipSkillIndexes.includes(possessSkills[i])){
    if(equipSkillIndexes.indexOf(possessSkills[i]) !== -1){
      isEquipSkill = true;
    }
    // for(var j=0; j<equipSkillIndexes.length; j++){
    //   if(equipSkillIndexes[j] === possessSkills[i]){
    //     isEquipSkill = true;
    //     break;
    //   }
    // }
    if(!isEquipSkill){
      var isNewSkill = false;
      // if(newSkills.includes(possessSkills[i])){
      if(newSkills.indexOf(possessSkills[i]) !== -1){
        isNewSkill = true;
      }
      var skillData = objectAssign({}, util.findData(skillTable, 'index', possessSkills[i]));
      var skillDiv = document.createElement('div');
      var imgContainer = document.createElement('div');
      imgContainer.classList.add('popUpskillImgContainer');
      var skillImg = document.createElement('img');
      skillDiv.setAttribute('skillIndex', possessSkills[i]);

      var newImg = document.createElement('img');
      newImg.src = '../images/newIcon.png';
      if(!isNewSkill){
        newImg.classList.add('disable');
      }
      skillDiv.appendChild(newImg);

      skillDiv.classList.add('popUpSkillContainerItem');
      // skillImg.src = skillData.skillIcon;
      skillImg.src = resourceUI;
      var iconData = objectAssign({}, util.findData(iconResourceTable, 'index', skillData.skillIcon));
      skillImg.style.clip = util.makeCssClipStyle(iconData, rate);
      util.setImgCssStyle(skillImg, iconData, rate);

      imgContainer.appendChild(skillImg);
      skillDiv.appendChild(imgContainer);
      popUpSkillContainer.appendChild(skillDiv);

      skillDiv.onclick = changeEquipSkillHandler.bind(this, skillDiv, gameConfig.SKILL_CHANGE_PANEL_CONTAINER, dontUpdateEquip);
    }
  }
};
function startVideoAdTimer(time){
  setTimeout(function(){
    videoAdComplete = false;
    var restartBtnSpan = restartButton.getElementsByTagName('span')[0];
    restartBtnSpan.innerHTML = 'Join Game <span class="small">(Ad)</span>';
  }, time);
};
// function refreshUtuber(){
//   var startSceneUtuber = document.getElementById('startSceneUtuber');
//   var standingSceneUtuber = document.getElementById('standingSceneUtuber');
//
//   var utuberCount = Object.keys(youtuberList).length;
//   var randomIndex = Math.floor(Math.random() * utuberCount) + 1;
//   startSceneUtuber.setAttribute('href', youtuberList[randomIndex].HREF);
//   standingSceneUtuber.setAttribute('href', youtuberList[randomIndex].HREF);
//   // startSceneUtuber.href = youtuberList[randomIndex].HREF;
//   // standingSceneUtuber.href = youtuberList[randomIndex].HREF;
//   startSceneUtuber.innerText = youtuberList[randomIndex].NAME;
//   standingSceneUtuber.innerText = youtuberList[randomIndex].NAME;
// };
function keyBindHandler(inputTag, keySettingsIndex){
  var inputVal = inputTag.value.substr(0, 1);
  var newKeyCode = parseInt(util.charToKeyCode(inputVal));
  if(inputVal == " "){
    //case void > space
    newKeyCode = 32;
  }
  var isDuplicate = false;
  for(var index in keySettings){
    if(index == keySettingsIndex){
      continue;
    }else if(keySettings[index] == newKeyCode){
      isDuplicate = true;
      break;
    }
  }
  if(isDuplicate){
    inputTag.value = '';
    this.makeFlashMessage('Key Duplicate!!!');
  }else if(newKeyCode){
    keySettings[keySettingsIndex] = newKeyCode;
    inputTag.value = '';
    if(inputVal == " "){
      inputTag.placeholder = 'Space';
    }else{
      inputTag.placeholder = inputVal.toUpperCase();
    }
  }else{
    inputTag.value = '';
  }
}
module.exports = UIManager;

},{"../public/csvjson.js":11,"../public/data.json":12,"../public/gameConfig.json":13,"../public/objectAssign.js":15,"../public/serverList.json":17,"../public/util.js":18,"../public/youtuberList.json":19}],9:[function(require,module,exports){
var util = require('../public/util.js');
var Skill = require('./CSkill.js');
var gameConfig = require('../public/gameConfig.json');

// var INTERVAL_TIMER = 1000/gameConfig.INTERVAL;
var INTERVAL_TIMER = 1000/40;

var User = function(userData, canvas, scaleFactor){
  this.objectID = userData.oID;

  this.name = userData.nm;
  this.type = userData.tp;
  this.imgData = userData.imgData;
  this.textCanvas = canvas;
  this.textScaleFactor = scaleFactor;

  this.isRender = true;
  this.hitImgDataList = [];
  this.buffImgDataList = [];

  this.imgHandIndex = 0;

  this.level = userData.lv;
  this.exp = userData.ep;

  this.maxHP = userData.mHP;
  this.maxMP = userData.mMP;
  this.HP = userData.HP;
  this.MP = userData.MP;
  this.castSpeed = userData.csp;
  this.conditions = userData.cdt;

  this.currentState = null;
  this.currentSkill = undefined;
  //use for execute skill only once.
  this.isExecutedSkill = false;
  //Effect around user skill effect, when cast skill. skill onFire set false.
  this.skillCastEffectPlay = false;
  this.castEffectFactor = 1;

  this.isMoveBackward = false;

  this.effectTimer = Date.now();
  this.effectRotateDegree = 0;
  this.effectIndex = 0;

  this.size = { width : gameConfig.USER_BODY_SIZE, height : gameConfig.USER_BODY_SIZE };

  this.position = userData.pos;
  this.targetPosition = userData.tpos;
  this.direction = userData.dir;
  this.rotateSpeed = userData.rsp;
  this.maxSpeed = userData.msp;

  this.center = {x : 0, y : 0};
  this.speed = {x : 0, y : 0};
  this.targetDirection = 0;

  this.timer = Date.now();
  this.castingEndTime = false;

  this.setCenter();
  this.setSpeed();
  this.setTargetDirection();

  this.chatMessage1 = "";
  this.chatMessage2 = "";
  this.chatMessage1StartTime = Date.now();
  this.chatMessage2StartTime = Date.now();
  // this.chatMessage = "";

  this.updateInterval = false;
  this.imgHandTimeout = false;
  // this.chatMessageTimeout = false;

  this.updateFunction = null;

  this.entityTreeEle = {
    x : this.position.x,
    y : this.position.y,
    width : this.size.width,
    height : this.size.height,
    id : this.objectID
  };
  this.moveUIUpdateTimer = Date.now();

  this.onMove = new Function();
  this.onMainUserMove = new Function();
};

User.prototype = {
  changeState : function(newState){
    this.currentState = newState;

    this.stop();
    switch (this.currentState) {
      case gameConfig.OBJECT_STATE_IDLE:
        this.updateFunction = this.idle.bind(this);
        break;
      case gameConfig.OBJECT_STATE_MOVE:
        this.updateFunction = this.rotate.bind(this);
        break;
      // case gameConfig.OBJECT_STATE_MOVE_OFFSET:
        // this.updateFunction = this.rotate.bind(this);
        // break;
      case gameConfig.OBJECT_STATE_ATTACK:
        this.updateFunction = this.attack.bind(this);
        break;
      case gameConfig.OBJECT_STATE_CAST:
        this.updateFunction = this.rotate.bind(this);
        break;
      case gameConfig.OBJECT_STATE_DEATH:
        this.updateFunction = this.idle.bind(this);
        break;
      case gameConfig.OBJECT_STATE_MOVE_AND_ATTACK:
        this.updateFunction = this.rotate.bind(this);
        break;
    }
    this.update();
  },
  update : function(){
    this.updateInterval = setInterval(this.updateFunction, INTERVAL_TIMER);
  },
  setCenter : function(){
    this.center.x = this.position.x + this.size.width/2,
    this.center.y = this.position.y + this.size.height/2
  },
  idle : function(){
    this.doEveryTick();
  },
  rotate : function(){
    var deltaTime = (Date.now() - this.timer)/1000;
    util.rotate.call(this, deltaTime);
    this.doEveryTick();
  },
  move : function(deltaTime, isMoveSlight){
    if(isMoveSlight){
      util.move.call(this, deltaTime, isMoveSlight)
    }else{
      util.move.call(this, deltaTime);
    }
    if(Date.now() - this.moveUIUpdateTimer > 500){
      this.moveUIUpdateTimer = Date.now();
      this.onMainUserMove();
    }
  },
  setTargetDirection : function(moveBackward){
    util.setTargetDirection.call(this, moveBackward);
  },
  setSpeed : function(decreaseRate){
    util.setSpeed.call(this, decreaseRate);
  },
  // moveOffset : function(){
  //   util.moveOffset.call(this);
  // },
  attack : function(){
    this.executeSkill();
    this.doEveryTick();
  },
  doEveryTick : function(){
    this.timer = Date.now();
    for(var i=this.hitImgDataList.length - 1; i>=0; i--){
      if(Date.now() - this.hitImgDataList[i].startTime >= this.hitImgDataList[i].resourceLifeTime){
        this.hitImgDataList.splice(i, 1);
      }
    }
    //chatMessage
    if(Date.now() - this.chatMessage1StartTime >= gameConfig.CHAT_MESSAGE_TIME){
      this.chatMessage1 = this.chatMessage2;
      this.chatMessage1StartTime = this.chatMessage2StartTime;

      this.chatMessage2 = "";
      this.chatMessage2StartTime = Date.now();
    }
    if(this.isRender){
      if(Date.now() - this.effectTimer >= gameConfig.USER_ATTACH_EFFECT_CHANGE_TIME){
        this.effectTimer = Date.now();
        this.effectRotateDegree += 10;
        if(this.effectIndex > 100){
          this.effectIndex = 0;
        }else{
          this.effectIndex += 1;
        }
        if(this.effectRotateDegree >= 360){
          this.effectRotateDegree -= 360;
        }
      }
    }
  },
  updateBuffImgData : function(buffImgDataList){
    this.buffImgDataList = buffImgDataList;
    // this.buffImgDataList = [];
    // for(var i=0; i<buffImgDataList.length; i++){
    //   this.buffImgDataList.push(buffImgDataList[i]);
    // }
  },
  updateSkillHitImgData : function(skillImgData){
    skillImgData.startTime = Date.now();
    this.hitImgDataList.push(skillImgData);
  },
  // addPosAndTargetPos : function(addPosX , addPosY){
  //   this.position.x += addPosX;
  //   this.position.y += addPosY;
  //
  //   this.targetPosition.x += addPosX;
  //   this.targetPosition.y += addPosY;
  //
  //   this.setCenter();
  // },
  stop : function(){
    if(this.updateInterval){
      clearInterval(this.updateInterval);
      this.updateInterval = false;
    }
    if(this.currentSkill){
      this.currentSkill.destroy();
      this.currentSkill = undefined;
      this.isExecutedSkill = false;
      this.skillCastEffectPlay = false;
    }
    if(this.imgHandTimeout){
      clearTimeout(this.imgHandTimeout);
      this.imgHandTimeout = false;
    }
    this.isMoveBackward = false;
    this.imgHandIndex = 0;
    this.castingEndTime = false;
  },
  setEntityEle : function(){
    this.entityTreeEle = {
      x : this.position.x,
      y : this.position.y,
      width : this.size.width,
      height : this.size.height,
      id : this.objectID
    };
  },
  makeSkillInstance : function(skillData){
    var userAniTime = Math.floor(gameConfig.USER_ANI_TIME * (100 / this.castSpeed));
    var skillInstance = new Skill(skillData, skillData.fireTime - userAniTime);
    skillInstance.onUserAniStart = onCastSkillHandler.bind(this, skillInstance, userAniTime);
    skillInstance.onTimeOver = onTimeOverHandler.bind(this, skillInstance);
    return skillInstance;
  },
  setSkill : function(skillInstance){
    this.currentSkill = skillInstance;
  },
  executeSkill : function(){
    try {
      if(!this.isExecutedSkill && this.currentSkill){
        this.skillCastEffectPlay = true;
        this.skillCastEffectStartTime = Date.now();
        this.isExecutedSkill = true;
        this.currentSkill.executeSkill();
      }
      this.setCastEffectFactor();
    } catch (e){
      console.warn(e);
    }
  },
  setCastEffectFactor : function(){
    var timeDiff = Date.now() - this.skillCastEffectStartTime;
    this.castEffectFactor = util.interpolationSine(timeDiff);
  },
  updateSkillPossessions : function(possessSkills){
    this.possessSkills = possessSkills;
  },
  makeProjectile : function(projectileID, skillInstance, direction){
    var projectile = skillInstance.makeProjectile(this.center, projectileID, direction);
    return projectile;
  },
  changePosition : function(newCenter){
    this.position.x = newCenter.x - this.size.width/2;
    this.position.y = newCenter.y - this.size.height/2;
    this.setCenter();
  },
  setChatMsg : function(msg){
    if(this.chatMessage2){
      this.chatMessage1 = this.chatMessage2;
      this.chatMessage1StartTime = this.chatMessage2StartTime;

      this.chatMessage2 = msg;
      this.chatMessage2StartTime = Date.now();
    }else if(this.chatMessage1){
      this.chatMessage2 = msg;
      this.chatMessage2StartTime = Date.now();
    }else{
      this.chatMessage1 = msg;
      this.chatMessage1StartTime = Date.now();
    }
    // if(this.chatMessageTimeout){
    //   clearTimeout(this.chatMessageTimeout);
    //   this.chatMessageTimeout = false;
    // }
    // this.chatMessage = msg;
    // var thisUser = this;
    // this.chatMessageTimeout = setTimeout(function(){
    //   thisUser.chatMessageTimeout = false;
    //   thisUser.chatMessage = "";
    // }, gameConfig.CHAT_MESSAGE_TIME);
  },
  getCurrentState : function(){
    return this.currentState;
  },
  getCurrentSkillIndex : function(){
    return this.currentSkill.index;
  },
  setRenderVar : function(isRender){
    //check user is in canvas if not dont update anything
    this.isRender = isRender;
  },
  updateTextCanvas : function(canvas){
    this.textCanvas = canvas;
  }
};

function onTimeOverHandler(skillInstance){
  skillInstance.destroy();
  this.currentSkill = undefined;
  this.isExecutedSkill = false;
  this.skillCastEffectPlay = false;

  this.castingEndTime = false;
  this.changeState(gameConfig.OBJECT_STATE_IDLE, 'onTimeOverHandler');
};
function onCastSkillHandler(skillInstance, userAniTime){
  var tickTime = userAniTime/5;
  // this.castingEndTime = Date.now() + userAniTime;
  this.castingEndTime = Date.now() + (skillInstance.totalTime - skillInstance.userAniStartTime);
  this.imgHandTimeout = setTimeout(imgHandTimeoutHandler.bind(this, tickTime), tickTime);
};
function imgHandTimeoutHandler(tickTime){
  if(this.imgHandIndex < 4){
    this.imgHandIndex++;
    this.imgHandTimeout = setTimeout(imgHandTimeoutHandler.bind(this, tickTime), tickTime);
  }else{
    this.imgHandIndex = 0;
    // this.castingEndTime = false;
  }
};
module.exports = User;

},{"../public/gameConfig.json":13,"../public/util.js":18,"./CSkill.js":7}],10:[function(require,module,exports){
(function (global){
//web socket client

var WebSocket = global.WebSocket || global.MozWebSocket;
// var msgpack = require('msgpack-js');
var msgpack = require('msgpack-lite');

function WebSocketClient(){
  this.isFirst = true;
	this.number = 0;	// Message number
	this.autoReconnectInterval = 2 * 1000;	// ms
}
WebSocketClient.prototype.open = function(url){
	this.url = url;
	this.instance = new WebSocket(this.url, [], { headers: { Cookie: document.cookie } });
  this.instance.binaryType = 'arraybuffer';
  this.instance.onopen = onopenHandler.bind(this);
  this.instance.onmessage = onmessageHandler.bind(this);
  this.instance.onclose = oncloseHandler.bind(this);
  this.instance.onerror = onerrorHandler.bind(this);
  // this.instance.addEventListener('open', onopenHandler.bind(this));
	// this.instance.addEventListener('message', onmessageHandler.bind(this));
	// this.instance.addEventListener('close', oncloseHandler.bind(this));
	// this.instance.addEventListener('error',onerrorHandler.bind(this));
}
WebSocketClient.prototype.send = function(data,option){
	try{
		this.instance.send(data,option);
	}catch (e){
		this.instance.emit('error',e);
	}
}
WebSocketClient.prototype.emit = function(type){
  var vars = [];
  for(var i=1; i<arguments.length; i++){
    vars.push(arguments[i]);
  }
  if(this.instance.readyState === 1){
    this.send(msgpack.encode({
      t: type,
      v: vars
    }));
  }
  // var vars = [];
  // for(var i=1; i<arguments.length; i++){
  //   vars.push(arguments[i]);
  // }
  // if(this.instance.readyState === 1){
  //   this.send(JSON.stringify({
  //     type: type,
  //     vars: vars
  //   }));
  // }
}
WebSocketClient.prototype.reconnect = function(e){
	console.warn('WebSocketClient: retry ',e);
  this.instance.onopen = new Function();
  this.instance.onmessage = new Function();
  this.instance.onclose = new Function();
  this.instance.onerror = new Function();
        // this.instance.removeAllListeners();
	// this.instance.removeEventListener('open', onopenHandler.bind(this));
	// this.instance.removeEventListener('message', onmessageHandler.bind(this));
	// this.instance.removeEventListener('close', oncloseHandler.bind(this));
	// this.instance.removeEventListener('error',onerrorHandler.bind(this));
	var that = this;
	setTimeout(function(){
		console.warn("WebSocketClient: reconnecting...");
		that.open(that.url);
	},this.autoReconnectInterval);
}
WebSocketClient.prototype.close = function(e){
  if (this.instance) {
    this.instance.close(e);
  }
}
WebSocketClient.prototype.onopen = function(e){	console.log("WebSocketClient: open", arguments);	}
WebSocketClient.prototype.onmessage = function(data,flags,number){	console.log("WebSocketClient: message", arguments);	}
WebSocketClient.prototype.onerror = function(e){	console.log("WebSocketClient: error", arguments);	}
WebSocketClient.prototype.onclose = function(e){	console.log("WebSocketClient: closed", arguments);	}

module.exports = WebSocketClient;

function onopenHandler(){
  if(this.isFirst){
    this.onopen();
  }else{
    this.emit('needReconnect');
  }
  this.isFirst = false;
}
function onmessageHandler(data,flags){
  this.number ++;
  this.onmessage(data,flags,this.number);
}
function onerrorHandler(e){
  switch (e.code){
  case 'ECONNREFUSED':
    this.reconnect(e);
    break;
  default:
    this.onerror(e);
    break;
  }
}
function oncloseHandler(e){
  switch (e){
  case 1000:	// CLOSE_NORMAL
    console.warn("WebSocket: closed");
    break;
  default:	// Abnormal closure
    this.reconnect(e);
    break;
  }
  // this.close();
  this.onclose(e);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"msgpack-lite":24}],11:[function(require,module,exports){

module.exports = {
    toObject        : toObject,
    toArray         : toArray,
    toColumnArray   : toColumnArray,
    toSchemaObject  : toSchemaObject,
    toCSV           : toCSV
}


function toColumnArray(data, opts){

    opts = opts || { };

    var delimiter   = (opts.delimiter || ',');
    var quote       = _getQuote(opts.quote);
    var content     = data;
    var headers     = null;

    if(typeof(content) !== "string"){
        throw new Error("Invalid input, input data should be a string");
    }

    content         = content.split(/[\n\r]+/ig);

    if(typeof(opts.headers) === "string"){
        headers = opts.headers.split(/[\n\r]+/ig);
        headers = quote ?
                _convertArray(headers.shift(), delimiter, quote) :
                headers.shift().split(delimiter);
    }else{
        headers = quote ?
                _convertArray(content.shift(), delimiter, quote) :
                content.shift().split(delimiter);
    }


    var hashData    = { };

    headers.forEach(function(item){
        hashData[item] = [];
    });

    content.forEach(function(item){
        if(item){
            item = quote ?
                  _convertArray(item, delimiter, quote) :
                  item.split(delimiter);
            item.forEach(function(val, index){
                hashData[headers[index]].push(_trimQuote(val));
            });
        }
    });

    return hashData;
}

function toObject(data, opts){

    opts = opts || { };

    var delimiter   = (opts.delimiter || ',');
    var quote       = _getQuote(opts.quote);
    var content     = data;
    var headers     = null;

    if(typeof(content) !== "string"){
        throw new Error("Invalid input, input data should be a string");
    }

    content = content.split(/[\n\r]+/ig);

    if(typeof(opts.headers) === "string"){
        headers = opts.headers.split(/[\n\r]+/ig);
        headers = quote ?
                _convertArray(headers.shift(), delimiter, quote) :
                headers.shift().split(delimiter);
    }else{
        headers = quote ?
                _convertArray(content.shift(), delimiter, quote) :
                content.shift().split(delimiter);
    }

    var hashData = [ ];
    content.forEach(function(item){
        if(item){
          item = quote ?
                _convertArray(item, delimiter, quote) :
                item.split(delimiter);
          var hashItem = { };
          headers.forEach(function(headerItem, index){
              var tempItem = _trimQuote(item[index]);
              if(parseInt(tempItem) || parseInt(tempItem) === 0){
                hashItem[headerItem] = parseInt(tempItem);
              }else if(parseFloat(tempItem)){
                hashItem[headerItem] = parseFloat(tempItem);
              }else{
                hashItem[headerItem] = tempItem;
              }
          });
          hashData.push(hashItem);
        }
    });
    return hashData;
}

function toSchemaObject(data, opts){

    opts = opts || { };

    var delimiter   = (opts.delimiter || ',');
    var quote       = _getQuote(opts.quote);
    var content     = data;
    var headers     = null;
    if(typeof(content) !== "string"){
        throw new Error("Invalid input, input should be a string");
    }

    content         = content.split(/[\n\r]+/ig);


    if(typeof(opts.headers) === "string"){
        headers = opts.headers.split(/[\n\r]+/ig);
        headers = quote ?
                _convertArray(headers.shift(), delimiter, quote) :
                headers.shift().split(delimiter);
    }else{
        headers = quote ?
                _convertArray(content.shift(), delimiter, quote) :
                content.shift().split(delimiter);
    }


    var hashData    = [ ];

    content.forEach(function(item){
        if(item){
          item = quote ?
                _convertArray(item, delimiter, quote) :
                item.split(delimiter);
            var schemaObject = {};
            item.forEach(function(val, index){
                _putDataInSchema(headers[index], val, schemaObject , delimiter, quote);
            });
            hashData.push(schemaObject);
        }
    });

    return hashData;
}

function toArray(data, opts){

    opts = opts || { };

    var delimiter   = (opts.delimiter || ',');
    var quote       = _getQuote(opts.quote);
    var content     = data;

    if(typeof(content) !== "string"){
        throw new Error("Invalid input, input data should be a string");
    }

    content = content.split(/[\n\r]+/ig);
    var arrayData = [ ];
    content.forEach(function(item){
        if(item){
            item = quote ?
                _convertArray(item, delimiter, quote) :
                item.split(delimiter);

            item = item.map(function(cItem){
                return _trimQuote(cItem);
            });
            arrayData.push(item);
        }
    });
    return arrayData;
}

function _getQuote(q){
  if(typeof(q) === "string"){
    return q;
  }else if(q === true){
    return '"';
  }
  return null;
}

function _dataType(arg) {
    if (arg === null) {
        return 'null';
    }
    else if (arg && (arg.nodeType === 1 || arg.nodeType === 9)) {
        return 'element';
    }
    var type = (Object.prototype.toString.call(arg)).match(/\[object (.*?)\]/)[1].toLowerCase();
    if (type === 'number') {
        if (isNaN(arg)) {
            return 'nan';
        }
        if (!isFinite(arg)) {
            return 'infinity';
        }
    }
    return type;
}

function toCSV(data, opts){

    opts                = (opts || { });
    opts.delimiter      = (opts.delimiter || ',');
    opts.wrap           = (opts.wrap || '');
    opts.arrayDenote    = (opts.arrayDenote && String(opts.arrayDenote).trim() ? opts.arrayDenote : '[]');
    opts.objectDenote   = (opts.objectDenote && String(opts.objectDenote).trim() ? opts.objectDenote : '.');
    opts.detailedOutput = (typeof(opts.detailedOutput) !== "boolean" ? true : opts.detailedOutput);
    opts.headers        = String(opts.headers).toLowerCase();
    var csvJSON         = { };
    var csvData         = "";

    if(!opts.headers.match(/none|full|relative|key/)){
      opts.headers = 'full';
    }else{
      opts.headers = opts.headers.match(/none|full|relative|key/)[0];
    }

    if(opts.wrap === true){
        opts.wrap = '"';
    }

    if(typeof(data) === "string"){
        data = JSON.parse(data);
    }

    _toCsv(data, csvJSON, "", 0, opts);

    var headers = _getHeaders(opts.headers, csvJSON, opts);

    if(headers){
      if(opts.wrap){
        headers = headers.map(function(item){
          return opts.wrap + item + opts.wrap;
        });
      }
      csvData = headers.join(opts.delimiter);
    }

    var bigArrayLen = _getBigArrayLength(csvJSON);
    var keys        = Object.keys(csvJSON);
    var row         = [ ];

    var replaceNewLinePattern = /\n|\r/g;
    if(!opts.wrap){
        replaceNewLinePattern = new RegExp('\n|\r|' + opts.delimiter, 'g');
    }


    for(var i = 0; i < bigArrayLen; i++){
        row = [ ];
        for(var j = 0; j < keys.length; j++){
            if(csvJSON[keys[j]][i]){
                csvJSON[keys[j]][i] = csvJSON[keys[j]][i].replace(replaceNewLinePattern, '\t');
                if(opts.wrap){
                    csvJSON[keys[j]][i] = opts.wrap + csvJSON[keys[j]][i] + opts.wrap;
                }
                row[row.length] = csvJSON[keys[j]][i];
            }else{
                row[row.length] = "";
            }
        }
      csvData += '\n' + row.join(opts.delimiter);
    }
    return csvData;
}

function _toCsv(data, table, parent, row, opt){
    if(_dataType(data) === 'undefined'){
        return _putData('', table, parent, row, opt);
    }else if(_dataType(data) === 'null'){
        return _putData('null', table, parent, row, opt);
    }else if(Array.isArray(data)){
        return _arrayToCsv(data, table, parent, row, opt);
    }else if(typeof(data) === "object"){
        return _objectToCsv(data, table, parent, row, opt);
    }else{
        return _putData(String(data), table, parent, row, opt);
    }
}

function _putData(data, table, parent, row, opt){
  if(!table || !table[parent]){
      table[parent] = [ ];
  }
  if(row < table[parent].length){
    row = table[parent].length;
  }
  table[parent][row] = data;
  return table;
}

function _arrayToCsv(data, table, parent, row, opt){
    if(_doesNotContainsObjectAndArray(data)){
      return _putData(data.join(';'), table, parent + opt.arrayDenote, row, opt);
    }
    data.forEach(function(item, index){
        return _toCsv(item, table, parent + opt.arrayDenote, index, opt);
    });
}

function _doesNotContainsObjectAndArray(array){
  return array.every(function(item){
        var datatype = _dataType(item);
        if(!datatype.match(/array|object/)){
          return true;
        }
        return false;
  });
}

function _objectToCsv(data, table, parent, row, opt){
  Object.keys(data).forEach(function(item){
      return _toCsv(data[item], table, parent + opt.objectDenote + item, row, opt);
  });
}

function _getHeaders(headerType, table, opt){
  var keyMatchPattern       = /([^\[\]\.]+)$/;
  var relativeMatchPattern  = /\[\]\.?([^\[\]]+)$/;
  switch(headerType){
    case "none":
      return null;
    case "full":
      return Object.keys(table);
    case "key":
      return Object.keys(table).map(function(header){
        var head = header.match(keyMatchPattern);
        if(head && head.length === 2){
          return head[1];
        }
        return header;
      });
    case "relative":
      return Object.keys(table).map(function(header){
        var head = header.match(relativeMatchPattern);
        if(head && head.length === 2){
          return head[1];
        }
        return header;
      });
  }
}

function _getBigArrayLength(table){
  var len = 0;
  Object.keys(table).forEach(function(item){
      if(Array.isArray(table[item]) && table[item].length > len){
        len = table[item].length;
      }
  });
  return len;
}

function _putDataInSchema(header, item, schema, delimiter, quote){
    var match = header.match(/\[*[\d]\]\.(\w+)|\.|\[\]|\[(.)\]|-|\+/ig);
    var headerName, currentPoint;
    if(match){
        var testMatch = match[0];
        if(match.indexOf('-') !== -1){
            return true;
        }else if(match.indexOf('.') !== -1){
            var headParts = header.split('.');
            currentPoint = headParts.shift();
            schema[currentPoint] = schema[currentPoint] || {};
            _putDataInSchema(headParts.join('.'), item, schema[currentPoint], delimiter, quote);
        }else if(match.indexOf('[]') !== -1){
            headerName = header.replace(/\[\]/ig,'');
            if(!schema[headerName]){
            schema[headerName] = [];
            }
            schema[headerName].push(item);
        }else if(/\[*[\d]\]\.(\w+)/.test(testMatch)){
            headerName = header.split('[').shift();
            var index = parseInt(testMatch.match(/\[(.)\]/).pop(),10);
            currentPoint = header.split('.').pop();
            schema[headerName] = schema[headerName] || [];
            schema[headerName][index] = schema[headerName][index] || {};
            schema[headerName][index][currentPoint] = item;
        }else if(/\[(.)\]/.test(testMatch)){
            var delimiter = testMatch.match(/\[(.)\]/).pop();
            headerName = header.replace(/\[(.)\]/ig,'');
            schema[headerName] = _convertArray(item, delimiter, quote);
        }else if(match.indexOf('+') !== -1){
            headerName = header.replace(/\+/ig,"");
            schema[headerName] = Number(item);
        }
    }else{
        schema[header] = _trimQuote(item);
    }
    return schema ;
}

function _trimQuote(str){
    if(str){
        return String(str).trim().replace(/^["|'](.*)["|']$/, '$1');
    }
    return "";
}

function _convertArray(str, delimiter, quote) {
    if(quote && str.indexOf(quote) !== -1){
      return _csvToArray(str, delimiter, quote);
    }
    var output = [];
    var arr = str.split(delimiter);
    arr.forEach(function(val) {
        var trimmed = val.trim();
        output.push(trimmed);
    });
    return output;
}

function _csvToArray(text, delimit, quote) {

    delimit = delimit || ",";
    quote   = quote || '"';

    var value = new RegExp("(?!\\s*$)\\s*(?:" +  quote + "([^" +  quote + "\\\\]*(?:\\\\[\\S\\s][^" +  quote + "\\\\]*)*)" +  quote + "|([^" +  delimit  +  quote + "\\s\\\\]*(?:\\s+[^" +  delimit  +  quote + "\\s\\\\]+)*))\\s*(?:" +  delimit + "|$)", "g");

    var a = [ ];

    text.replace(value,
        function(m0, m1, m2) {
            if(m1 !== undefined){
                a.push(m1.replace(/\\'/g, "'"));
            }else if(m2 !== undefined){
                a.push(m2);
            }
            return '';
        }
    );

    if (/,\s*$/.test(text)){
        a.push('');
    }
    return a;
}

},{}],12:[function(require,module,exports){
module.exports={
  "userStatData" : "index,level,needExp,type,power,magic,speed,imgData,levelUpGold,levelUpJewel\n1,1,150,1,32,20,28,1,0,0\n2,2,200,1,34,21,29,1,300,1\n3,3,250,1,36,22,31,1,400,0\n4,4,300,1,37,23,32,1,450,0\n5,5,350,1,39,24,33,1,500,1\n6,6,400,1,41,25,35,2,600,0\n7,7,500,1,42,26,36,2,700,0\n8,8,600,1,44,27,37,2,800,1\n9,9,700,1,46,28,39,2,900,0\n10,10,800,1,47,29,40,2,1000,2\n11,11,900,1,49,30,41,3,1100,0\n12,12,1000,1,51,31,43,3,1200,0\n13,13,1100,1,52,32,44,3,1300,2\n14,14,1300,1,54,33,45,3,1400,0\n15,15,1500,1,56,34,47,3,1500,3\n16,16,1700,1,57,35,48,4,1700,0\n17,17,1900,1,59,36,49,4,1900,0\n18,18,2200,1,61,37,51,4,2100,3\n19,19,2500,1,62,38,52,4,2300,0\n20,20,-1,1,64,39,53,5,2500,4\n101,1,150,2,28,32,20,6,0,0\n102,2,200,2,29,34,21,6,300,1\n103,3,250,2,31,36,22,6,400,0\n104,4,300,2,32,37,23,6,450,0\n105,5,350,2,33,39,24,6,500,1\n106,6,400,2,35,41,25,7,600,0\n107,7,500,2,36,42,26,7,700,0\n108,8,600,2,37,44,27,7,800,1\n109,9,700,2,39,46,28,7,900,0\n110,10,800,2,40,47,29,7,1000,2\n111,11,900,2,41,49,30,8,1100,0\n112,12,1000,2,43,51,31,8,1200,0\n113,13,1100,2,44,52,32,8,1300,2\n114,14,1300,2,45,54,33,8,1400,0\n115,15,1500,2,47,56,34,8,1500,3\n116,16,1700,2,48,57,35,9,1700,0\n117,17,1900,2,49,59,36,9,1900,0\n118,18,2200,2,51,61,37,9,2100,3\n119,19,2500,2,52,62,38,9,2300,0\n120,20,-1,2,53,64,39,10,2500,4\n201,1,150,3,23,28,29,11,0,0\n202,2,200,3,24,29,31,11,300,1\n203,3,250,3,25,31,33,11,400,0\n204,4,300,3,26,32,34,11,450,0\n205,5,350,3,27,33,36,11,500,1\n206,6,400,3,28,35,38,12,600,0\n207,7,500,3,29,36,39,12,700,0\n208,8,600,3,30,37,41,12,800,1\n209,9,700,3,31,39,43,12,900,0\n210,10,800,3,32,40,44,12,1000,2\n211,11,900,3,33,41,46,13,1100,0\n212,12,1000,3,34,43,48,13,1200,0\n213,13,1100,3,35,44,49,13,1300,2\n214,14,1300,3,36,45,51,13,1400,0\n215,15,1500,3,37,47,53,13,1500,3\n216,16,1700,3,38,48,54,14,1700,0\n217,17,1900,3,39,49,56,14,1900,0\n218,18,2200,3,40,51,58,14,2100,3\n219,19,2500,3,41,52,59,14,2300,0\n220,20,-1,3,42,53,61,15,2500,4\n",
  "skillData" : "index,name,level,type,property,tier,groupIndex,nextSkillIndex,totalTime,fireTime,cooldown,range,explosionRadius,explosionDamageRate,consumeMP,fireDamage,frostDamage,arcaneDamage,doDamageToMP,damageToMPRate,doDamageToSelf,damageToSelfRate,healHP,healHPRate,healMP,healMPRate,repeatDelay,repeatCount,buffToSelf,buffToTarget,projectileCount,radius,maxSpeed,lifeTime,tickTime,upgradeGoldAmount,upgradeJewelAmount,clientName,clientDesc,effectLastTime,skillIcon,hitEffectGroup,explosionEffectGroup,projectileEffectGroup,exchangeToGold,exchangeToJewel\n11,PyroBaseAttack1,1,1,1,1,10,12,500,400,150,60,45,0,0,150,0,0,0,0,0,0,0,0,0,0,0,0,,1,0,0,0,0,0,10000,10000,Pyro Attack,◈ Damage to near front &nbsp;◈ Ignite enemy(20%),300,1,6,,,0,\n12,PyroBaseAttack2,2,1,1,1,10,13,500,400,150,60,45,0,0,160,0,0,0,0,0,0,0,0,0,0,0,0,,1,0,0,0,0,0,10000,10000,Pyro Attack,◈ Damage to near front &nbsp;◈ Ignite enemy(20%) <img src='/images/upIcon.png' class='disable' />,300,1,6,,,0,\n13,PyroBaseAttack3,3,1,1,1,10,14,500,400,150,60,47,0,0,170,0,0,0,0,0,0,0,0,0,0,0,0,,2,0,0,0,0,0,10000,10000,Pyro Attack,◈ Damage to near front &nbsp;◈ Ignite enemy(30%),300,1,6,,,0,\n14,PyroBaseAttack4,4,1,1,1,10,15,500,400,150,60,47,0,0,185,0,0,0,0,0,0,0,0,0,0,0,0,,2,0,0,0,0,0,10000,10000,Pyro Attack,◈ Damage to near front &nbsp;◈ Ignite enemy(30%) <img src='/images/upIcon.png' class='disable' />,300,1,6,,,0,\n15,PyroBaseAttack5,5,1,1,1,10,-1,500,400,150,60,50,0,0,200,0,0,0,0,0,0,0,0,0,0,0,0,,3,0,0,0,0,0,10000,10000,Pyro Attack,◈ Damage to near front &nbsp;◈ Ignite enemy(40%),300,1,6,,,0,\n21,FireBolt1,1,3,1,1,20,22,500,300,2500,0,0,0,40,250,0,0,0,0,0,0,0,0,0,0,0,0,,2,1,30,650,1500,0,500,0,Fire Bolt,◈ Fire projectile &nbsp;◈ Ignite enemy(30%),0,2,6,,,50,\n22,FireBolt2,2,3,1,1,20,23,500,300,2500,0,0,0,50,275,0,0,0,0,0,0,0,0,0,0,0,0,,2,1,30,650,1500,0,1000,0,Fire Bolt,◈ Fire projectile &nbsp;◈ Ignite enemy(30%) <img src='/images/upIcon.png' class='disable' />,0,2,6,,,50,\n23,FireBolt3,3,3,1,1,20,24,500,300,2500,0,0,0,60,290,0,0,0,0,0,0,0,0,0,0,0,0,,3,1,32,650,1500,0,2000,1,Fire Bolt,◈ Fire projectile &nbsp;◈ Ignite enemy(40%),0,2,6,,,50,\n24,FireBolt4,4,3,1,1,20,25,500,300,2500,0,0,0,70,305,0,0,0,0,0,0,0,0,0,0,0,0,,3,1,32,650,1500,0,3000,2,Fire Bolt,◈ Fire projectile &nbsp;◈ Ignite enemy(40%) <img src='/images/upIcon.png' class='disable' />,0,2,6,,,50,\n25,FireBolt5,5,3,1,1,20,-1,500,300,2500,0,0,0,80,320,0,0,0,0,0,0,0,0,0,0,0,0,,4,1,35,650,1500,0,0,0,Fire Bolt,◈ Fire projectile &nbsp;◈ Ignite enemy(50%),0,2,6,,,50,\n31,BurningSoul1,1,11,1,1,30,32,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,,0,0,0,0,0,500,0,Burning Soul,◈ +4 HP regen <img src='/images/upIcon.png' class='disable' />,0,3,,,,50,\n32,BurningSoul2,2,11,1,1,30,33,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7,,0,0,0,0,0,1000,0,Burning Soul,◈ +6 HP regen <img src='/images/upIcon.png' class='disable' />  <img src='/images/plusIcon.png' class='disable' />,0,3,,,,50,\n33,BurningSoul3,3,11,1,1,30,34,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,,0,0,0,0,0,2000,1,Burning Soul,◈ +7 HP regen <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ +300 HP,0,3,,,,50,\n34,BurningSoul4,4,11,1,1,30,35,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,,0,0,0,0,0,3000,2,Burning Soul,◈ +9 HP regen <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ +300 HP <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,0,3,,,,50,\n35,BurningSoul5,5,11,1,1,30,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,,0,0,0,0,0,0,0,Burning Soul,◈ +10 HP regen &nbsp;◈ +500 HP &nbsp;◈ +10% Damage rate,0,3,,,,50,\n41,FireBall1,1,4,1,1,40,42,800,600,8000,0,110,0,100,470,0,0,0,0,0,0,0,0,0,0,0,0,,2,1,30,550,1500,0,1000,0,Fire Ball,◈ Fire explosive projectile &nbsp;◈ Ignite enemy(30%),300,4,6,,,100,\n42,FireBall2,2,4,1,1,40,43,800,600,8000,0,110,0,120,490,0,0,0,0,0,0,0,0,0,0,0,0,,2,1,30,550,1500,0,1500,1,Fire Ball,◈ Fire explosive projectile &nbsp;◈ Ignite enemy(30%) <img src='/images/upIcon.png' class='disable' />,300,4,6,,,100,\n43,FireBall3,3,4,1,1,40,44,800,600,8000,0,120,0,140,510,0,0,0,0,0,0,0,0,0,0,0,0,,3,1,35,550,1500,0,2500,2,Fire Ball,◈ Fire explosive projectile &nbsp;◈ Ignite enemy(40%),300,4,6,,,100,\n44,FireBall4,4,4,1,1,40,45,800,600,8000,0,120,0,160,530,0,0,0,0,0,0,0,0,0,0,0,0,,3,1,35,550,1500,0,3500,3,Fire Ball,◈ Fire explosive projectile &nbsp;◈ Ignite enemy(40%) <img src='/images/upIcon.png' class='disable' />,300,4,6,,,100,\n45,FireBall5,5,4,1,1,40,-1,800,600,8000,0,130,0,180,550,0,0,0,0,0,0,0,0,0,0,0,0,,4,1,40,550,1500,0,0,0,Fire Ball,◈ Fire explosive projectile &nbsp;◈ Ignite enemy(50%),300,4,6,,,100,\n51,InnerFire1,1,8,1,2,50,52,500,300,25000,0,0,0,100,0,0,0,0,0,1,100,0,0,0,0,0,0,11,16,0,0,0,0,0,1000,0,Inner Fire,◈ +20% Damage rate <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ Make Ignite oneself,0,5,,,,100,\n52,InnerFire2,2,8,1,2,50,53,500,300,25000,0,0,0,120,0,0,0,0,0,1,100,0,0,0,0,0,0,12,16,0,0,0,0,0,1500,1,Inner Fire,◈ +27% Damage rate <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ Make Ignite oneself <img src='/images/plusIcon.png' class='disable' />,0,5,,,,100,\n53,InnerFire3,3,8,1,2,50,54,500,300,25000,0,0,0,140,0,0,0,0,0,1,100,0,0,0,0,0,0,13,16,0,0,0,0,0,2500,2,Inner Fire,◈ +30% Damage rate <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ Make Ignite oneself &nbsp;◈ +10% Fire resistance,0,5,,,,100,\n54,InnerFire4,4,8,1,2,50,55,500,300,25000,0,0,0,160,0,0,0,0,0,1,100,0,0,0,0,0,0,14,16,0,0,0,0,0,3500,3,Inner Fire,◈ +37% Damage rate <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ Make Ignite oneself &nbsp;◈ +10% Fire resistance <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,0,5,,,,100,\n55,InnerFire5,5,8,1,2,50,-1,500,300,25000,0,0,0,180,0,0,0,0,0,1,100,0,0,0,0,0,0,15,16,0,0,0,0,0,0,0,Inner Fire,◈ +40% Damage rate &nbsp;◈ Make Ignite oneself &nbsp;◈ +15% Fire resistance &nbsp;◈ +3 HP regen,0,5,,,,100,\n61,RollingFire1,1,5,1,3,60,62,800,600,15000,0,0,0,130,80,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,50,280,2000,60,1500,1,Rolling Fire,◈ Fire rolling projectile &nbsp;◈ Ignite enemy(20%),0,6,6,,1007,150,\n62,RollingFire2,2,5,1,3,60,63,800,600,15000,0,0,0,160,85,0,0,0,0,0,0,0,0,0,0,0,0,,1,1,50,280,2000,60,2000,2,Rolling Fire,◈ Fire rolling projectile &nbsp;◈ Ignite enemy(20%) <img src='/images/upIcon.png' class='disable' />,0,6,6,,1007,150,\n63,RollingFire3,3,5,1,3,60,64,800,600,15000,0,0,0,190,90,0,0,0,0,0,0,0,0,0,0,0,0,,2,1,53,280,2000,60,3000,3,Rolling Fire,◈ Fire rolling projectile &nbsp;◈ Ignite enemy(30%),0,6,6,,1007,150,\n64,RollingFire4,4,5,1,3,60,65,800,600,15000,0,0,0,220,95,0,0,0,0,0,0,0,0,0,0,0,0,,2,1,53,280,2000,60,4000,4,Rolling Fire,◈ Fire rolling projectile &nbsp;◈ Ignite enemy(30%) <img src='/images/upIcon.png' class='disable' />,0,6,6,,1007,150,\n65,RollingFire5,5,5,1,3,60,-1,800,600,15000,0,0,0,250,100,0,0,0,0,0,0,0,0,0,0,0,0,,3,1,55,280,2000,60,0,0,Rolling Fire,◈ Fire rolling projectile &nbsp;◈ Ignite enemy(40%),0,6,6,,1007,150,\n71,Fury1,1,11,1,3,70,72,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,17,,0,0,0,0,0,1500,1,Fury,◈ +5% Move and Cast speed <img src='/images/upIcon.png' class='disable' />,0,7,,,,150,\n72,Fury2,2,11,1,3,70,73,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,,0,0,0,0,0,2000,2,Fury,◈ +8% Move and Cast speed <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,0,7,,,,150,\n73,Fury3,3,11,1,3,70,74,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,19,,0,0,0,0,0,3000,3,Fury,◈ +10% Move and Cast speed <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ +10% Move and Cast speed[While Ignite],0,7,,,,150,\n74,Fury4,4,11,1,3,70,75,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,20,,0,0,0,0,0,4000,4,Fury,◈ +13% Move and Cast speed <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ +10% Move and Cast speed[While Ignite] <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,0,7,,,,150,\n75,Fury5,5,11,1,3,70,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,21,,0,0,0,0,0,0,0,Fury,◈ +15% Move and Cast speed &nbsp;◈ +15% Move and Cast speed[While Ignite] &nbsp;◈ +10% Cooldown reduce rate,0,7,,,,150,\n81,Explosion1,1,9,1,4,80,82,1300,1100,20000,0,200,0,130,550,0,0,0,0,1,40,0,0,0,0,0,0,,5,0,0,0,0,0,2000,1,Explosion,◈ Damage to near position &nbsp;◈ Ignite enemy and oneself(100%) &nbsp;◈ Damage to self(40%) <img src='/images/upIcon.png' class='disable' />,300,8,6,,,200,\n82,Explosion2,2,9,1,4,80,83,1300,1100,20000,0,200,0,160,575,0,0,0,0,1,35,0,0,0,0,0,0,,5,0,0,0,0,0,2500,2,Explosion,◈ Damage to near position &nbsp;◈ Ignite enemy and oneself(100%) &nbsp;◈ Damage to self(35%) <img src='/images/upIcon.png' class='disable' />,300,8,6,,,200,\n83,Explosion3,3,9,1,4,80,84,1300,1100,20000,0,225,0,190,600,0,0,0,0,1,30,0,0,0,0,0,0,,5,0,0,0,0,0,3500,3,Explosion,◈ Damage to near position &nbsp;◈ Ignite enemy and oneself(100%) &nbsp;◈ Damage to self(30%) <img src='/images/upIcon.png' class='disable' />,300,8,6,,,200,\n84,Explosion4,4,9,1,4,80,85,1300,1100,20000,0,225,0,220,625,0,0,0,0,1,25,0,0,0,0,0,0,,5,0,0,0,0,0,4500,4,Explosion,◈ Damage to near position &nbsp;◈ Ignite enemy and oneself(100%) &nbsp;◈ Damage to self(25%) <img src='/images/upIcon.png' class='disable' />,300,8,6,,,200,\n85,Explosion5,5,9,1,4,80,-1,1300,1100,20000,0,250,0,250,650,0,0,0,0,1,20,0,0,0,0,0,0,,5,0,0,0,0,0,0,0,Explosion,◈ Damage to near position &nbsp;◈ Ignite enemy and oneself(100%) &nbsp;◈ Damage to self(20%),300,8,6,,,200,\n91,Pyromaniac1,1,11,1,5,90,92,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,22,,0,0,0,0,0,10000,10000,Pyromaniac,◈ +5 Power <img src='/images/upIcon.png' class='disable' /> &nbsp;  ◈ +10% Fire Damage rate <img src='/images/upIcon.png' class='disable' />,0,9,,,,0,\n92,Pyromaniac2,2,11,1,5,90,93,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,23,,0,0,0,0,0,10000,10000,Pyromaniac,◈ +8 Power <img src='/images/upIcon.png' class='disable' /> &nbsp;  ◈ +14% Fire Damage rate <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,0,9,,,,0,\n93,Pyromaniac3,3,11,1,5,90,94,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,24,,0,0,0,0,0,10000,10000,Pyromaniac,◈ +10 Power <img src='/images/upIcon.png' class='disable' /> &nbsp;  ◈ +17% Fire Damage rate <img src='/images/upIcon.png' class='disable' /> &nbsp; ◈ 3% Damage Rate Per 10% Life Loss <img src='/images/upIcon.png' class='disable' />,0,9,,,,0,\n94,Pyromaniac4,4,11,1,5,90,95,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,25,,0,0,0,0,0,10000,10000,Pyromaniac,◈ +13 Power <img src='/images/upIcon.png' class='disable' /> &nbsp;  ◈ +21% Fire Damage rate <img src='/images/upIcon.png' class='disable' /> &nbsp; ◈ 4% Damage Rate Per 10% Life Loss <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,0,9,,,,0,\n95,Pyromaniac5,5,11,1,5,90,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,26,,0,0,0,0,0,10000,10000,Pyromaniac,◈ +15 Power &nbsp;  ◈ +25% Fire Damage rate &nbsp; ◈ +15% Cast Speed &nbsp; ◈ +5% Damage Rate Per 10% Life Loss,0,9,,,,0,\n1001,FrosterBaseAttack1,1,1,2,1,1000,1002,600,400,150,60,47,0,0,0,140,0,0,0,0,0,0,0,0,0,0,0,,102,0,0,0,0,0,10000,10000,Froster Attack,◈ Damage to near front &nbsp;◈ Chill enemy(25%),300,101,7,,,0,\n1002,FrosterBaseAttack2,2,1,2,1,1000,1003,600,400,150,60,47,0,0,0,150,0,0,0,0,0,0,0,0,0,0,0,,102,0,0,0,0,0,10000,10000,Froster Attack,◈ Damage to near front &nbsp;◈ Chill enemy(25%) <img src='/images/upIcon.png' class='disable' />,300,101,7,,,0,\n1003,FrosterBaseAttack3,3,1,2,1,1000,1004,600,400,150,60,50,0,0,0,160,0,0,0,0,0,0,0,0,0,0,0,,103,0,0,0,0,0,10000,10000,Froster Attack,◈ Damage to near front &nbsp;◈ Chill enemy(30%),300,101,7,,,0,\n1004,FrosterBaseAttack4,4,1,2,1,1000,1005,600,400,150,60,50,0,0,0,170,0,0,0,0,0,0,0,0,0,0,0,,103,0,0,0,0,0,10000,10000,Froster Attack,◈ Damage to near front &nbsp;◈ Chill enemy(30%) <img src='/images/upIcon.png' class='disable' />,300,101,7,,,0,\n1005,FrosterBaseAttack5,5,1,2,1,1000,-1,600,400,150,60,53,0,0,0,180,0,0,0,0,0,0,0,0,0,0,0,,104,0,0,0,0,0,10000,10000,Froster Attack,◈ Damage to near front &nbsp;◈ Chill enemy(35%),300,101,7,,,0,\n1011,IceBolt1,1,3,2,1,1010,1012,500,300,2500,0,0,0,50,0,230,0,0,0,0,0,0,0,0,0,0,0,,105,1,32,650,1500,0,500,0,Ice Bolt,◈ Fire projectile &nbsp;◈ Chill enemy(40%),300,102,7,,,50,\n1012,IceBolt2,2,3,2,1,1010,1013,500,300,2500,0,0,0,60,0,245,0,0,0,0,0,0,0,0,0,0,0,,105,1,32,650,1500,0,1000,0,Ice Bolt,◈ Fire projectile &nbsp;◈ Chill enemy(40%) <img src='/images/upIcon.png' class='disable' />,300,102,7,,,50,\n1013,IceBolt3,3,3,2,1,1010,1014,500,300,2500,0,0,0,70,0,260,0,0,0,0,0,0,0,0,0,0,0,,106,1,34,650,1500,0,2000,1,Ice Bolt,◈ Fire projectile &nbsp;◈ Chill enemy(45%),300,102,7,,,50,\n1014,IceBolt4,4,3,2,1,1010,1015,500,300,2500,0,0,0,80,0,285,0,0,0,0,0,0,0,0,0,0,0,,106,1,34,650,1500,0,3000,2,Ice Bolt,◈ Fire projectile &nbsp;◈ Chill enemy(45%) <img src='/images/upIcon.png' class='disable' />,300,102,7,,,50,\n1015,IceBolt5,5,3,2,1,1010,-1,500,300,2500,0,0,0,90,0,300,0,0,0,0,0,0,0,0,0,0,0,,107,1,36,650,1500,0,0,0,Ice Bolt,◈ Fire projectile &nbsp;◈ Chill enemy(50%),300,102,7,,,50,\n1021,Healing1,1,8,2,1,1020,1022,500,300,12000,0,0,0,80,0,0,0,0,0,0,0,350,0,0,0,0,0,2000,,0,0,0,0,0,500,0,Healing,◈ Heal 300 HP <img src='/images/upIcon.png' class='disable' />,300,103,,,,50,\n1022,Healing2,2,8,2,1,1020,1023,500,300,12000,0,0,0,95,0,0,0,0,0,0,0,400,0,0,0,0,0,2000,,0,0,0,0,0,1000,0,Healing,◈ Heal 360 HP <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,300,103,,,,50,\n1023,Healing3,3,8,2,1,1020,1024,500,300,12000,0,0,0,110,0,0,0,0,0,0,0,450,0,0,0,0,0,116,,0,0,0,0,0,2000,1,Healing,◈ Heal 400 HP <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ Every second +2% HP Restore,300,103,,,,50,\n1024,Healing4,4,8,2,1,1020,1025,500,300,12000,0,0,0,125,0,0,0,0,0,0,0,500,0,0,0,0,0,116,,0,0,0,0,0,3000,2,Healing,◈ Heal 460 HP <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ Every second +2% HP Restore <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,300,103,,,,50,\n1025,Healing5,5,8,2,1,1020,-1,500,300,12000,0,0,0,140,0,0,0,0,0,0,0,550,0,0,20,0,0,117,,0,0,0,0,0,0,0,Healing,◈ Heal 500 HP &nbsp;◈ Every second +3% HP Restore &nbsp;◈ +20% MP Restore,300,103,,,,50,\n1031,FrozenSoul1,1,11,2,1,1030,1032,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,111,,0,0,0,0,0,500,0,Frozen Soul,◈ +3 MP regen <img src='/images/upIcon.png' class='disable' />,300,104,,,,50,\n1032,FrozenSoul2,2,11,2,1,1030,1033,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,112,,0,0,0,0,0,1000,0,Frozen Soul,◈ +5 MP regen <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,300,104,,,,50,\n1033,FrozenSoul3,3,11,2,1,1030,1034,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,113,,0,0,0,0,0,2000,1,Frozen Soul,◈ +6 MP regen <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ +150 MP,300,104,,,,50,\n1034,FrozenSoul4,4,11,2,1,1030,1035,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,114,,0,0,0,0,0,3000,2,Frozen Soul,◈ +8 MP regen <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ +150 MP <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,300,104,,,,50,\n1035,FrozenSoul5,5,11,2,1,1030,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,115,,0,0,0,0,0,0,0,Frozen Soul,◈ +9 MP regen &nbsp;◈ +300 MP &nbsp;◈ +10% All Resistance ,300,104,,,,50,\n1041,Purify1,1,8,2,2,1040,1042,500,300,20000,0,0,0,120,0,0,0,0,0,0,0,0,0,0,0,0,0,118,,0,0,0,0,0,1000,0,Purify,◈ Every second Dispel oneself &nbsp;◈ Every second +3% HP Restore <img src='/images/upIcon.png' class='disable' />,300,105,,,,100,\n1042,Purify2,2,8,2,2,1040,1043,500,300,20000,0,0,0,120,0,0,0,0,0,0,0,0,0,0,0,0,0,119,,0,0,0,0,0,1500,1,Purify,◈ Every second Dispel oneself &nbsp;◈ Every second +4% HP Restore,300,105,,,,100,\n1043,Purify3,3,8,2,2,1040,1044,500,300,20000,0,0,0,100,0,0,0,0,0,0,0,0,0,0,0,0,0,120,,0,0,0,0,0,2500,2,Purify,◈ Every second Dispel oneself &nbsp;◈ Every second +4% HP Restore <img src='/images/upIcon.png' class='disable' />,300,105,,,,100,\n1044,Purify4,4,8,2,2,1040,1045,500,300,20000,0,0,0,100,0,0,0,0,0,0,0,0,0,0,0,0,0,121,,0,0,0,0,0,3500,3,Purify,◈ Every second Dispel oneself &nbsp;◈ Every second +5% HP Restore,300,105,,,,100,\n1045,Purify5,5,8,2,2,1040,-1,500,300,20000,0,0,0,80,0,0,0,0,0,0,0,0,0,0,0,0,0,122,,0,0,0,0,0,0,0,Purify,◈ Every second Dispel oneself &nbsp;◈ Every second +5% HP Restore,300,105,,,,100,\n1051,IceBlock1,1,8,2,2,1050,1052,500,300,25000,0,0,0,120,0,0,0,0,0,1,100,0,0,0,0,0,0,123,137,0,0,0,0,0,1000,0,Ice Block,◈ Make Immortal(4s) and Freeze oneself(3s) &nbsp;◈ Every second +5% HP Restore <img src='/images/upIcon.png' class='disable' />,300,106,,,,100,\n1052,IceBlock2,2,8,2,2,1050,1053,500,300,25000,0,0,0,120,0,0,0,0,0,1,100,0,0,0,0,0,0,124,137,0,0,0,0,0,1500,1,Ice Block,◈ Make Immortal(4s) and Freeze oneself(3s) &nbsp;◈ Every second +6% HP Restore <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,300,106,,,,100,\n1053,IceBlock3,3,8,2,2,1050,1054,500,300,25000,0,0,0,100,0,0,0,0,0,1,100,0,0,0,0,0,0,125,137,0,0,0,0,0,2500,2,Ice Block,◈ Make Immortal(4s) and Freeze oneself(3s) &nbsp;◈ Every second +7% HP Restore <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ Every second +5% MP Restore,300,106,,,,100,\n1054,IceBlock4,4,8,2,2,1050,1055,500,300,25000,0,0,0,100,0,0,0,0,0,1,100,0,0,0,0,0,0,126,137,0,0,0,0,0,3500,3,Ice Block,◈ Make Immortal(4s) and Freeze oneself(3s) &nbsp;◈ Every second +8% HP Restore <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ Every second +5% MP Restore <img src='/images/upIcon.png' class='disable' />,300,106,,,,100,\n1055,IceBlock5,5,8,2,2,1050,-1,500,300,25000,0,0,0,80,0,0,0,0,0,1,100,0,0,0,0,0,0,127,137,0,0,0,0,0,0,0,Ice Block,◈ Make Immortal(4s) and Freeze oneself(3s) &nbsp;◈ Every second +10% HP Restore &nbsp;◈ Every second +8% MP Restore,300,106,,,,100,\n1061,ColdSnap1,1,7,2,3,1060,1062,850,600,15000,410,120,0,60,0,110,0,0,0,0,0,0,0,0,0,350,1,,108,0,0,0,0,0,1500,1,Cold Snap,◈ Damage target area(3 times) &nbsp;◈ Chill enemy(70%),250,107,7,,,150,\n1062,ColdSnap2,2,7,2,3,1060,1063,850,600,15000,410,120,0,65,0,115,0,0,0,0,0,0,0,0,0,350,1,,108,0,0,0,0,0,2000,2,Cold Snap,◈ Damage target area(3 times) <img src='/images/upIcon.png' class='disable' />&nbsp;◈ Chill enemy(70%) ,250,107,7,,,150,\n1063,ColdSnap3,3,7,2,3,1060,1064,850,600,15000,430,130,0,65,0,115,0,0,0,0,0,0,0,0,0,350,2,,108,0,0,0,0,0,3000,3,Cold Snap,◈ Damage target area(4 times) &nbsp;◈ Chill enemy(70%),250,107,7,,,150,\n1064,ColdSnap4,4,7,2,3,1060,1065,850,600,15000,430,130,0,70,0,120,0,0,0,0,0,0,0,0,0,350,2,,108,0,0,0,0,0,4000,4,Cold Snap,◈ Damage target area(4 times) <img src='/images/upIcon.png' class='disable' />&nbsp;◈ Chill enemy(70%) ,250,107,7,,,150,\n1065,ColdSnap5,5,7,2,3,1060,-1,850,600,15000,450,140,0,70,0,120,0,0,0,0,0,0,0,0,0,350,3,,108,0,0,0,0,0,0,0,Cold Snap,◈ Damage target area(5 times) &nbsp;◈ Chill enemy(70%),250,107,7,,,150,\n1071,FrozenOrb1,1,6,2,4,1070,1072,800,600,15000,0,120,800,160,0,75,0,0,0,0,0,0,0,0,0,0,0,,101,1,52,280,2000,60,2000,1,Frozen Orb,◈ Fire rolling explosive projectile &nbsp;◈ Chill enemy(20%),300,108,7,1008,1008,200,\n1072,FrozenOrb2,2,6,2,4,1070,1073,800,600,15000,0,120,800,180,0,80,0,0,0,0,0,0,0,0,0,0,0,,101,1,52,280,2000,60,2500,2,Frozen Orb,◈ Fire rolling explosive projectile &nbsp;◈ Chill enemy(20%) <img src='/images/upIcon.png' class='disable' />,300,108,7,1008,1008,200,\n1073,FrozenOrb3,3,6,2,4,1070,1074,800,600,15000,0,130,800,200,0,85,0,0,0,0,0,0,0,0,0,0,0,,102,1,54,280,2000,60,3500,3,Frozen Orb,◈ Fire rolling explosive projectile &nbsp;◈ Chill enemy(25%),300,108,7,1008,1008,200,\n1074,FrozenOrb4,4,6,2,4,1070,1075,800,600,15000,0,130,800,220,0,90,0,0,0,0,0,0,0,0,0,0,0,,102,1,54,280,2000,60,4500,4,Frozen Orb,◈ Fire rolling explosive projectile &nbsp;◈ Chill enemy(25%) <img src='/images/upIcon.png' class='disable' />,300,108,7,1008,1008,200,\n1075,FrozenOrb5,5,6,2,4,1070,-1,800,600,15000,0,140,800,240,0,95,0,0,0,0,0,0,0,0,0,0,0,,103,1,56,280,2000,60,0,0,Frozen Orb,◈ Fire rolling explosive projectile &nbsp;◈ Chill enemy(30%),300,108,7,1008,1008,200,\n1081,IceSpear1,1,3,2,2,1080,1082,550,300,8000,0,0,0,60,0,150,0,0,0,0,0,0,0,0,0,0,0,,102,3,27,500,1000,0,1500,0,Ice Spear,◈ Fire 3 projectile &nbsp;◈ Chill enemy(25%),300,110,7,,,150,\n1082,IceSpear2,2,3,2,2,1080,1083,550,300,8000,0,0,0,65,0,160,0,0,0,0,0,0,0,0,0,0,0,,102,3,27,500,1000,0,2000,1,Ice Spear,◈ Fire 3 projectile <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ Chill enemy(25%) <img src='/images/upIcon.png' class='disable' />,300,110,7,,,150,\n1083,IceSpear3,3,3,2,2,1080,1084,550,300,8000,0,0,0,65,0,160,0,0,0,0,0,0,0,0,0,250,1,,103,3,27,500,1000,0,3000,2,Ice Spear,◈ Fire 3 projectile (2 times)&nbsp;◈ Chill enemy(30%),300,110,7,,,150,\n1084,IceSpear4,4,3,2,2,1080,1085,550,300,8000,0,0,0,70,0,170,0,0,0,0,0,0,0,0,0,250,1,,103,3,27,500,1000,0,4000,3,Ice Spear,◈ Fire 3 projectile (2 times)<img src='/images/upIcon.png' class='disable' /> &nbsp;◈ Chill enemy(30%) <img src='/images/upIcon.png' class='disable' />,300,110,7,,,150,\n1085,IceSpear5,5,3,2,2,1080,-1,550,300,8000,0,0,0,70,0,170,0,0,0,0,0,0,0,0,0,250,2,,104,3,27,500,1000,0,0,0,Ice Spear,◈ Fire 3 projectile (3 times)&nbsp;◈ Chill enemy(35%),300,110,7,,,150,\n1091,Freezer1,1,11,2,5,1090,1092,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,,0,0,0,0,0,10000,10000,Freezer,◈ +5 Magic <img src='/images/upIcon.png' class='disable' /> &nbsp;  ◈ +10% Frost Damage rate <img src='/images/upIcon.png' class='disable' />,0,109,,,,0,\n1092,Freezer2,2,11,2,5,1090,1093,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,129,,0,0,0,0,0,10000,10000,Freezer,◈ +8 Magic <img src='/images/upIcon.png' class='disable' /> &nbsp;  ◈ +14% Frost Damage rate <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,0,109,,,,0,\n1093,Freezer3,3,11,2,5,1090,1094,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,130,,0,0,0,0,0,10000,10000,Freezer,◈ +10 Magic <img src='/images/upIcon.png' class='disable' /> &nbsp;  ◈ +17% Frost Damage rate <img src='/images/upIcon.png' class='disable' /> &nbsp; ◈ Can Make Freezing When Hit Chill Enemy(15%) <img src='/images/upIcon.png' class='disable' />,0,109,,,,0,\n1094,Freezer4,4,11,2,5,1090,1095,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,131,,0,0,0,0,0,10000,10000,Freezer,◈ +13 Magic <img src='/images/upIcon.png' class='disable' /> &nbsp;  ◈ +21% Frost Damage rate <img src='/images/upIcon.png' class='disable' /> &nbsp; ◈ Can Make Freezing When Hit Chill Enemy(20%) <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,0,109,,,,0,\n1095,Freezer5,5,11,2,5,1090,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,132,,0,0,0,0,0,10000,10000,Freezer,◈ +15 Magic &nbsp;  ◈ +25% Frost Damage rate &nbsp; ◈ +7.5% Move Speed &nbsp; ◈ Can Make Freezing When Hit Chill Enemy(25%),0,109,,,,0,\n2001,MysterBaseAttack1,1,1,3,1,2000,2002,600,400,150,60,45,0,0,0,0,140,1,20,0,0,0,0,0,0,0,0,,,0,0,0,0,0,10000,10000,Myster Attack,◈ Damage to near front &nbsp;◈ Burn enemy MP(20%),300,201,8,,,0,\n2002,MysterBaseAttack2,2,1,3,1,2000,2003,600,400,150,60,45,0,0,0,0,150,1,20,0,0,0,0,0,0,0,0,,,0,0,0,0,0,10000,10000,Myster Attack,◈ Damage to near front &nbsp;◈ Burn enemy MP(20%) <img src='/images/upIcon.png' class='disable' />,300,201,8,,,0,\n2003,MysterBaseAttack3,3,1,3,1,2000,2004,600,400,150,60,47,0,0,0,0,160,1,25,0,0,0,0,0,0,0,0,,,0,0,0,0,0,10000,10000,Myster Attack,◈ Damage to near front &nbsp;◈ Burn enemy MP(25%),300,201,8,,,0,\n2004,MysterBaseAttack4,4,1,3,1,2000,2005,600,400,150,60,47,0,0,0,0,170,1,25,0,0,0,0,0,0,0,0,,,0,0,0,0,0,10000,10000,Myster Attack,◈ Damage to near front &nbsp;◈ Burn enemy MP(25%) <img src='/images/upIcon.png' class='disable' />,300,201,8,,,0,\n2005,MysterBaseAttack5,5,1,3,1,2000,-1,600,400,150,60,50,0,0,0,0,180,1,30,0,0,0,0,0,0,0,0,,,0,0,0,0,0,10000,10000,Myster Attack,◈ Damage to near front &nbsp;◈ Burn enemy MP(30%),300,201,8,,,0,\n2011,ArcaneBolt1,1,3,3,1,2010,2012,500,300,2400,0,0,0,45,0,0,230,1,20,0,0,0,0,0,0,0,0,,,1,30,650,1500,0,500,0,Arcane Bolt,◈ Fire projectile &nbsp;◈ Burn enemy MP(20%),300,202,8,,,50,\n2012,ArcaneBolt2,2,3,3,1,2010,2013,500,300,2400,0,0,0,55,0,0,245,1,20,0,0,0,0,0,0,0,0,,,1,30,650,1500,0,1000,0,Arcane Bolt,◈ Fire projectile &nbsp;◈ Burn enemy MP(20%) <img src='/images/upIcon.png' class='disable' />,300,202,8,,,50,\n2013,ArcaneBolt3,3,3,3,1,2010,2014,500,300,2400,0,0,0,65,0,0,260,1,25,0,0,0,0,0,0,0,0,,,1,32,650,1500,0,2000,1,Arcane Bolt,◈ Fire projectile &nbsp;◈ Burn enemy MP(25%),300,202,8,,,50,\n2014,ArcaneBolt4,4,3,3,1,2010,2015,500,300,2400,0,0,0,75,0,0,285,1,25,0,0,0,0,0,0,0,0,,,1,32,650,1500,0,3000,2,Arcane Bolt,◈ Fire projectile &nbsp;◈ Burn enemy MP(25%) <img src='/images/upIcon.png' class='disable' />,300,202,8,,,50,\n2015,ArcaneBolt5,5,3,3,1,2010,-1,500,300,2400,0,0,0,85,0,0,300,1,30,0,0,0,0,0,0,0,0,,,1,35,650,1500,0,0,0,Arcane Bolt,◈ Fire projectile &nbsp;◈ Burn enemy MP(30%),300,202,8,,,50,\n2021,ArcaneCloak1,1,11,3,1,2020,2022,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,201,,0,0,0,0,0,500,0,Arcane Cloak,◈ +10% All Resistance <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,0,203,,,,50,\n2022,ArcaneCloak2,2,11,3,1,2020,2023,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,202,,0,0,0,0,0,1000,0,Arcane Cloak,◈ +11% All Resistance <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ +5% Arcane Resistance <img src='/images/plusIcon.png' class='disable' />,0,203,,,,50,\n2023,ArcaneCloak3,3,11,3,1,2020,2024,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,203,,0,0,0,0,0,2000,1,Arcane Cloak,◈ +12% All Resistance <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ +5% Arcane Resistance &nbsp;◈ +5% Frost Resistance <img src='/images/plusIcon.png' class='disable' />,0,203,,,,50,\n2024,ArcaneCloak4,4,11,3,1,2020,2025,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,204,,0,0,0,0,0,3000,2,Arcane Cloak,◈ +13% All Resistance <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ +5% Arcane Resistance <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ +5% Frost Resistance <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ +5% Fire Resistance <img src='/images/upIcon.png' class='disable' />,0,203,,,,50,\n2025,ArcaneCloak5,5,11,3,1,2020,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,205,,0,0,0,0,0,0,0,Arcane Cloak,◈ +15% All Resistance &nbsp;◈ + 10% Arcane Resistance &nbsp;◈ +10% Frost Resistance &nbsp;◈ +10% Fire Resistance,0,203,,,,50,\n2031,ArcaneMissile1,1,3,3,2,2030,2032,500,300,6000,0,0,0,110,0,0,200,1,15,0,0,0,0,0,0,0,0,,,3,25,500,1500,0,1000,0,Arcane Missile,◈ Fire 3 projectile &nbsp;◈ Burn enemy MP(15%),300,204,8,,,100,\n2032,ArcaneMissile2,2,3,3,2,2030,2033,500,300,6000,0,0,0,130,0,0,220,1,15,0,0,0,0,0,0,0,0,,,3,25,500,1500,0,1500,1,Arcane Missile,◈ Fire 3 projectile <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ Burn enemy MP(15%),300,204,8,,,100,\n2033,ArcaneMissile3,3,3,3,2,2030,2034,500,300,6000,0,0,0,150,0,0,220,1,15,0,0,0,0,0,0,0,0,,,4,25,500,1500,0,2500,2,Arcane Missile,◈ Fire 4 projectile &nbsp;◈ Burn enemy MP(15%),300,204,8,,,100,\n2034,ArcaneMissile4,4,3,3,2,2030,2035,500,300,6000,0,0,0,170,0,0,230,1,15,0,0,0,0,0,0,0,0,,,4,25,500,1500,0,3500,3,Arcane Missile,◈ Fire 4 projectile <img src='/images/upIcon.png' class='disable' /> &nbsp;◈ Burn enemy MP(15%),300,204,8,,,100,\n2035,ArcaneMissile5,5,3,3,2,2030,-1,500,300,6000,0,0,0,190,0,0,230,1,15,0,0,0,0,0,0,0,0,,,5,25,500,1500,0,0,0,Arcane Missile,◈ Fire 5 projectile &nbsp;◈ Burn enemy MP(15%),300,204,8,,,100,\n2041,Silence1,1,7,3,2,2040,2042,500,300,16000,360,110,0,110,0,0,0,0,0,0,0,0,0,0,0,0,0,,206,0,0,0,0,0,1000,0,Silence,◈ Silence enemy,300,205,,1009,,100,\n2042,Silence2,2,7,3,2,2040,2043,500,300,16000,360,110,0,130,0,0,0,0,0,0,0,0,0,0,0,0,0,,207,0,0,0,0,0,1500,1,Silence,◈ Silence enemy,300,205,,1009,,100,\n2043,Silence3,3,7,3,2,2040,2044,500,300,14000,380,120,0,150,0,0,0,0,0,0,0,0,0,0,0,0,0,,207,0,0,0,0,0,2500,2,Silence,◈ Silence enemy,300,205,,1009,,100,\n2044,Silence4,4,7,3,2,2040,2045,500,300,14000,380,120,0,170,0,0,0,0,0,0,0,0,0,0,0,0,0,,208,0,0,0,0,0,3500,3,Silence,◈ Silence enemy,300,205,,1009,,100,\n2045,Silence5,5,7,3,2,2040,-1,500,300,12000,400,130,0,190,0,0,0,0,0,0,0,0,0,0,0,0,0,,208,0,0,0,0,0,0,0,Silence,◈ Silence enemy,300,205,,1009,,100,\n2061,Blink1,1,10,3,3,2060,2062,500,300,11000,200,40,0,100,0,0,0,0,0,0,0,0,0,0,0,0,0,,,0,0,0,0,0,1500,1,Blink,◈ Move direct to target position,300,207,,,,150,\n2062,Blink2,2,10,3,3,2060,2063,500,300,11000,225,40,0,100,0,0,0,0,0,0,0,0,0,0,0,0,0,,,0,0,0,0,0,2000,2,Blink,◈ Move direct to target position,300,207,,,,150,\n2063,Blink3,3,10,3,3,2060,2064,500,300,10000,225,40,0,90,0,0,0,0,0,0,0,0,0,0,0,0,0,,,0,0,0,0,0,3000,3,Blink,◈ Move direct to target position,300,207,,,,150,\n2064,Blink4,4,10,3,3,2060,2065,500,300,10000,250,40,0,90,0,0,0,0,0,0,0,0,0,0,0,0,0,,,0,0,0,0,0,4000,4,Blink,◈ Move direct to target position,300,207,,,,150,\n2065,Blink5,5,10,3,3,2060,-1,500,300,9000,250,40,0,80,0,0,0,0,0,0,0,0,0,0,0,0,0,,,0,0,0,0,0,0,0,Blink,◈ Move direct to target position,300,207,,,,150,\n2071,ArcaneBlast1,1,7,3,3,2070,2072,800,600,14000,370,110,0,110,0,0,400,1,20,0,0,0,0,0,0,0,0,,,0,0,0,0,0,1500,1,Arcane Blast,◈ Damage to target area &nbsp;◈ Burn enemy MP(20%),300,208,8,,,150,\n2072,ArcaneBlast2,2,7,3,3,2070,2073,800,600,14000,370,110,0,135,0,0,425,1,20,0,0,0,0,0,0,0,0,,,0,0,0,0,0,2000,2,Arcane Blast,◈ Damage to target area &nbsp;◈ Burn enemy MP(20%) <img src='/images/upIcon.png' class='disable' />,300,208,8,,,150,\n2073,ArcaneBlast3,3,7,3,3,2070,2074,800,600,14000,410,120,0,160,0,0,450,1,25,0,0,0,0,0,0,0,0,,,0,0,0,0,0,3000,3,Arcane Blast,◈ Damage to target area &nbsp;◈ Burn enemy MP(25%),300,208,8,,,150,\n2074,ArcaneBlast4,4,7,3,3,2070,2075,800,600,14000,410,120,0,185,0,0,475,1,25,0,0,0,0,0,0,0,0,,,0,0,0,0,0,4000,4,Arcane Blast,◈ Damage to target area &nbsp;◈ Burn enemy MP(25%) <img src='/images/upIcon.png' class='disable' />,300,208,8,,,150,\n2075,ArcaneBlast5,5,7,3,3,2070,-1,800,600,14000,450,130,0,210,0,0,500,1,30,0,0,0,0,0,0,0,0,,,0,0,0,0,0,0,0,Arcane Blast,◈ Damage to target area &nbsp;◈ Burn enemy MP(30%),300,208,8,,,150,\n2081,Haste1,1,8,3,3,2080,2082,500,300,35000,0,0,0,110,0,0,0,0,0,0,0,0,0,0,0,0,0,211,,0,0,0,0,0,1500,1,Haste,◈ +20% Move and Cast speed <img src='/images/upIcon.png' class='disable' />,300,209,,,,150,\n2082,Haste2,2,8,3,3,2080,2083,500,300,35000,0,0,0,135,0,0,0,0,0,0,0,0,0,0,0,0,0,212,,0,0,0,0,0,2000,2,Haste,◈ +23% Move and Cast speed <img src='/images/upIcon.png' class='disable' />,300,209,,,,150,\n2083,Haste3,3,8,3,3,2080,2084,500,300,32000,0,0,0,160,0,0,0,0,0,0,0,0,0,0,0,0,0,213,,0,0,0,0,0,3000,3,Haste,◈ +25% Move and Cast speed <img src='/images/upIcon.png' class='disable' />,300,209,,,,150,\n2084,Haste4,4,8,3,3,2080,2085,500,300,32000,0,0,0,185,0,0,0,0,0,0,0,0,0,0,0,0,0,214,,0,0,0,0,0,4000,4,Haste,◈ +28% Move and Cast speed <img src='/images/upIcon.png' class='disable' />,300,209,,,,150,\n2085,Haste5,5,8,3,3,2080,-1,500,300,30000,0,0,0,210,0,0,0,0,0,0,0,0,0,0,0,0,0,215,,0,0,0,0,0,0,0,Haste,◈ +30% Move and Cast speed <img src='/images/upIcon.png' class='disable' />,300,209,,,,150,\n2091,Mystic1,1,11,3,5,2090,2092,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,216,,0,0,0,0,0,10000,10000,Mystic,◈ +2 All Stat <img src='/images/upIcon.png' class='disable' /> &nbsp;  ◈ +10% All Damage rate <img src='/images/upIcon.png' class='disable' />,0,210,,,,0,\n2092,Mystic2,2,11,3,5,2090,2093,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,217,,0,0,0,0,0,10000,10000,Mystic,◈ +4 All Stat <img src='/images/upIcon.png' class='disable' /> &nbsp;  ◈ +13% All Damage rate <img src='/images/upIcon.png' class='disable' /> <img src='/images/plusIcon.png' class='disable' />,0,210,,,,0,\n2093,Mystic3,3,11,3,5,2090,2094,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,218,,0,0,0,0,0,10000,10000,Mystic,◈ +5 All Stat <img src='/images/upIcon.png' class='disable' /> &nbsp;  ◈ +15% All Damage rate <img src='/images/upIcon.png' class='disable' /> &nbsp; ◈ Add Random Buff When Use Arcane Spell <img src='/images/upIcon.png' class='disable' /> ,0,210,,,,0,\n2094,Mystic4,4,11,3,5,2090,2095,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,219,,0,0,0,0,0,10000,10000,Mystic,◈ +7 All Stat <img src='/images/upIcon.png' class='disable' /> &nbsp;  ◈ +18% All Damage rate <img src='/images/upIcon.png' class='disable' /> &nbsp; ◈ Add Random Buff When Use Arcane Spell <img src='/images/upIcon.png' class='disable' />,0,210,,,,0,\n2095,Mystic5,5,11,3,5,2090,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,220,,0,0,0,0,0,10000,10000,Mystic,◈ +8 All Stat &nbsp;  ◈ +20% All Damage rate &nbsp; ◈ +15% Cooldown Reduce rate &nbsp; ◈ Add Random Buff When Use Arcane Spell,0,210,,,,0,\n",
  "buffGroupData" : "index,name,clientName,clientDesc,isBuff,buff1,buff2,buff3,buff4,buff5,buff6,buff7,buff8,buff9,buff10,buffLifeTime,buffApplyRate,buffIcon,buffEffectGroup\n1,Ignite20,Ignite,◈ Damage 3% of Max HP,0,1,,,,,,,,,,5000,20,515,5\n2,Ignite30,Ignite,◈ Damage 3% of Max HP,0,1,,,,,,,,,,5000,30,515,5\n3,Ignite40,Ignite,◈ Damage 3% of Max HP,0,1,,,,,,,,,,5000,40,515,5\n4,Ignite50,Ignite,◈ Damage 3% of Max HP,0,1,,,,,,,,,,5000,50,515,5\n5,Ignite100,Ignite,◈ Damage 3% of Max HP,0,1,,,,,,,,,,5000,100,515,5\n6,BurningSoul1,BurningSoul,◈ +4 HP regen,1,22,,,,,,,,,,0,100,501,1010\n7,BurningSoul2,BurningSoul,◈ +6 HP regen,1,23,,,,,,,,,,0,100,501,1010\n8,BurningSoul3,BurningSoul,◈ +7 HP regen &nbsp;◈ +300 HP,1,24,3,,,,,,,,,0,100,501,1010\n9,BurningSoul4,BurningSoul,◈ +9 HP regen &nbsp;◈ +300 HP,1,25,3,,,,,,,,,0,100,501,1010\n10,BurningSoul5,BurningSoul,◈ +10 HP regen &nbsp;◈ +500 HP &nbsp;◈ +10% Damage rate,1,26,4,82,,,,,,,,0,100,501,1010\n11,InnerFire1,InnerFire,◈ +20% Damage rate &nbsp;◈ Make Ignite oneself,1,86,,,,,,,,,,10000,100,502,1001\n12,InnerFire2,InnerFire,◈ +27% Damage rate &nbsp;◈ Make Ignite oneself,1,87,,,,,,,,,,10000,100,502,1001\n13,InnerFire3,InnerFire,◈ +30% Damage rate &nbsp;◈ Make Ignite oneself &nbsp;◈ +10% Fire resistance,1,88,123,,,,,,,,,10000,100,502,1001\n14,InnerFire4,InnerFire,◈ +37% Damage rate &nbsp;◈ Make Ignite oneself &nbsp;◈ +10% Fire resistance,1,89,123,,,,,,,,,10000,100,502,1001\n15,InnerFire5,InnerFire,◈ +40% Damage rate &nbsp;◈ Make Ignite oneself &nbsp;◈ +15% Fire resistance &nbsp;◈ +3 HP regen,1,90,124,21,,,,,,,,10000,100,502,1001\n16,InnerFireIgnite,Ignite,◈ Damage 3% of Max HP,0,1,,,,,,,,,,10000,100,515,5\n17,Fury1,Fury,◈ +5% Move and Cast speed,1,32,45,,,,,,,,,0,100,503,1002\n18,Fury2,Fury,◈ +8% Move and Cast speed,1,33,46,,,,,,,,,0,100,503,1002\n19,Fury3,Fury,◈ +10% Move and Cast speed &nbsp;◈ If ignite additional +10% Move and Cast speed,1,35,47,57,59,,,,,,,0,100,503,1002\n20,Fury4,Fury,◈ +13% Move and Cast speed &nbsp;◈ If ignite additional +10% Move and Cast speed,1,37,49,57,59,,,,,,,0,100,503,1002\n21,Fury5,Fury,◈ +15% Move and Cast speed &nbsp;◈ If ignite additional +15% Move and Cast speed &nbsp;◈ +10% Cooldown reduce rate,1,38,50,58,60,113,,,,,,0,100,503,1002\n22,Pyromaniac1,Pyromaniac,◈ +5 Power &nbsp;  ◈ +10% Fire Damage rate,1,63,91,,,,,,,,,0,100,504,101\n23,Pyromaniac2,Pyromaniac,◈ +8 Power &nbsp;  ◈ +14% Fire Damage rate,1,65,92,,,,,,,,,0,100,504,101\n24,Pyromaniac3,Pyromaniac,◈ +10 Power &nbsp;  ◈ +17% Fire Damage rate &nbsp; ◈ 3% Damage Rate Per 10% Life Loss,1,66,93,101,,,,,,,,0,100,504,101\n25,Pyromaniac4,Pyromaniac,◈ +13 Power &nbsp;  ◈ +21% Fire Damage rate &nbsp; ◈ 4% Damage Rate Per 10% Life Loss,1,67,94,102,,,,,,,,0,100,504,101\n26,Pyromaniac5,Pyromaniac,◈ +15 Power &nbsp;  ◈ +25% Fire Damage rate &nbsp; ◈ +15% Cast Speed &nbsp; ◈ +5% Damage Rate Per 10% Life Loss,1,68,95,103,50,,,,,,,0,100,504,101\n101,Chill20,Chill,◈ Decrease 30% Move and Cast Speed,0,2,,,,,,,,,,3000,20,516,2\n102,Chill25,Chill,◈ Decrease 30% Move and Cast Speed,0,2,,,,,,,,,,3000,25,516,2\n103,Chill30,Chill,◈ Decrease 30% Move and Cast Speed,0,2,,,,,,,,,,3000,30,516,2\n104,Chill35,Chill,◈ Decrease 30% Move and Cast Speed,0,2,,,,,,,,,,3000,35,516,2\n105,Chill40,Chill,◈ Decrease 30% Move and Cast Speed,0,2,,,,,,,,,,3000,40,516,2\n106,Chill45,Chill,◈ Decrease 30% Move and Cast Speed,0,2,,,,,,,,,,3000,45,516,2\n107,Chill50,Chill,◈ Decrease 30% Move and Cast Speed,0,2,,,,,,,,,,3000,50,516,2\n108,Chill70,Chill,◈ Decrease 30% Move and Cast Speed,0,2,,,,,,,,,,3000,70,516,2\n109,Chill85,Chill,◈ Decrease 30% Move and Cast Speed,0,2,,,,,,,,,,3000,85,516,2\n110,Chill100,Chill,◈ Decrease 30% Move and Cast Speed,0,2,,,,,,,,,,3000,100,516,2\n111,FrozenSoul1,FrozenSoul,◈ +3 MP regen,1,27,,,,,,,,,,0,100,505,1011\n112,FrozenSoul2,FrozenSoul,◈ +5 MP regen,1,28,,,,,,,,,,0,100,505,1011\n113,FrozenSoul3,FrozenSoul,◈ +6 MP regen &nbsp;◈ +150 MP,1,29,5,,,,,,,,,0,100,505,1011\n114,FrozenSoul4,FrozenSoul,◈ +8 MP regen &nbsp;◈ +150 MP,1,30,5,,,,,,,,,0,100,505,1011\n115,FrozenSoul5,FrozenSoul,◈ +9 MP regen &nbsp;◈ +300 MP &nbsp;◈ +10% All Resistance ,1,31,6,115,,,,,,,,0,100,505,1011\n116,Heal3,Heal,◈ +2% HP Restore,1,8,,,,,,,,,,5000,100,514,1012\n117,Heal5,Heal,◈ +3% HP Restore,1,9,,,,,,,,,,5000,100,514,1012\n118,Purify1,Purify,◈ Purify oneself &nbsp;◈ +3% HP Restore,1,9,110,,,,,,,,,3000,100,506,1012\n119,Purify2,Purify,◈ Purify oneself &nbsp;◈ +4% HP Restore,1,10,110,,,,,,,,,3000,100,506,1012\n120,Purify3,Purify,◈ Purify oneself &nbsp;◈ +4% HP Restore,1,10,110,,,,,,,,,4000,100,506,1012\n121,Purify4,Purify,◈ Purify oneself &nbsp;◈ +5% HP Restore,1,11,110,,,,,,,,,4000,100,506,1012\n122,Purify5,Purify,◈ Purify oneself &nbsp;◈ +5% HP Restore,1,11,110,,,,,,,,,5000,100,506,1012\n123,IceBlock1,IceBlock,◈ Immortal &nbsp;◈ +5% HP Restore,1,145,11,,,,,,,,,4000,100,507,1\n124,IceBlock2,IceBlock,◈ Immortal &nbsp;◈ +6% HP Restore,1,145,12,,,,,,,,,4000,100,507,1\n125,IceBlock3,IceBlock,◈ Immortal &nbsp;◈ +7% HP and MP Restore &nbsp;◈ +5% MP Restore,1,145,13,18,,,,,,,,4000,100,507,1\n126,IceBlock4,IceBlock,◈ Immortal &nbsp;◈ +8% HP and MP Restore &nbsp;◈ +5% MP Restore,1,145,14,18,,,,,,,,4000,100,507,1\n127,IceBlock5,IceBlock,◈ Immortal &nbsp;◈ +10% HP and MP Restore &nbsp;◈ +8% MP Restore,1,145,15,19,,,,,,,,4000,100,507,1\n128,Freezer1,Freezer,◈ +5 Magic &nbsp;  ◈ +10% Frost Damage rate,1,71,96,,,,,,,,,0,100,508,102\n129,Freezer2,Freezer,◈ +8 Magic &nbsp;  ◈ +14% Frost Damage rate,1,73,97,,,,,,,,,0,100,508,102\n130,Freezer3,Freezer,◈ +10 Magic &nbsp;  ◈ +17% Frost Damage rate &nbsp; ◈ Can Make Freezing When Hit Chill Enemy(15%),1,74,98,104,,,,,,,,0,100,508,102\n131,Freezer4,Freezer,◈ +13 Magic &nbsp;  ◈ +21% Frost Damage rate &nbsp; ◈ Can Make Freezing When Hit Chill Enemy(20%),1,75,99,105,,,,,,,,0,100,508,102\n132,Freezer5,Freezer,◈ +15 Magic &nbsp;  ◈ +25% Frost Damage rate &nbsp; ◈ +7.5% Move Speed &nbsp; ◈ Can Make Freezing When Hit Chill Enemy(25%),1,76,100,106,34,,,,,,,0,100,508,102\n133,Freeze1,Freeze,◈ Frozen &nbsp;◈ Can`t do anything!!!,0,108,,,,,,,,,,1000,15,517,3\n134,Freeze2,Freeze,◈ Frozen &nbsp;◈ Can`t do anything!!!,0,108,,,,,,,,,,1000,20,517,3\n135,Freeze3,Freeze,◈ Frozen &nbsp;◈ Can`t do anything!!!,0,108,,,,,,,,,,1000,25,517,3\n136,Freeze5,Freeze,◈ Frozen &nbsp;◈ Can`t do anything!!!,0,108,,,,,,,,,,1000,100,517,3\n137,IceBlockFreeze,Freeze,◈ Frozen &nbsp;◈ Can`t do anything!!!,0,109,,,,,,,,,,3000,100,517,3\n201,ArcaneCloak1,ArcaneCloak,◈ +10% All Resistance,1,115,,,,,,,,,,0,100,509,1005\n202,ArcaneCloak2,ArcaneCloak,◈ +11% All Resistance &nbsp;◈ +5% Arcane Resistance,1,116,125,,,,,,,,,0,100,509,1005\n203,ArcaneCloak3,ArcaneCloak,◈ +12% All Resistance &nbsp;◈ +5% Arcane Resistance &nbsp;◈ +5% Frost Resistance,1,117,125,127,,,,,,,,0,100,509,1005\n204,ArcaneCloak4,ArcaneCloak,◈ +13% All Resistance &nbsp;◈ +5% Arcane Resistance &nbsp;◈ +5% Frost Resistance &nbsp;◈ +5% Fire Resistance,1,118,125,127,122,,,,,,,0,100,509,1005\n205,ArcaneCloak5,ArcaneCloak,◈ +15% All Resistance &nbsp;◈ + 10% Arcane Resistance &nbsp;◈ +10% Frost Resistance &nbsp;◈ +10% Fire Resistance,1,119,126,128,123,,,,,,,0,100,509,1005\n206,Silence1,Silence,◈ Silenced &nbsp;◈ Can`t cast spell!!!,0,129,,,,,,,,,,3000,100,518,4\n207,Silence2,Silence,◈ Silenced &nbsp;◈ Can`t cast spell!!!,0,129,,,,,,,,,,4000,100,518,4\n208,Silence3,Silence,◈ Silenced &nbsp;◈ Can`t cast spell!!!,0,129,,,,,,,,,,5000,100,518,4\n209,Dispel,Dispel,◈ Dispel Buff,0,112,,,,,,,,,,500,100,519,1013\n210,DispelSelf,Dispel,◈ Dispel Debuff,0,111,,,,,,,,,,500,100,513,1013\n211,Haste1,Haste,◈ +15% Move and Cast speed,1,40,52,,,,,,,,,10000,100,510,1006\n212,Haste2,Haste,◈ +18% Move and Cast speed,1,41,53,,,,,,,,,10000,100,510,1006\n213,Haste3,Haste,◈ +20% Move and Cast speed,1,42,54,,,,,,,,,15000,100,510,1006\n214,Haste4,Haste,◈ +23% Move and Cast speed,1,43,55,,,,,,,,,15000,100,510,1006\n215,Haste5,Haste,◈ +25% Move and Cast speed,1,44,56,,,,,,,,,15000,100,510,1006\n216,Mystic1,Mystic,◈ +2 All Stat &nbsp;  ◈ +10% All Damage rate,1,61,69,77,82,,,,,,,0,100,511,103\n217,Mystic2,Mystic,◈ +4 All Stat &nbsp;  ◈ +13% All Damage rate,1,62,70,78,83,,,,,,,0,100,511,103\n218,Mystic3,Mystic,◈ +5 All Stat &nbsp;  ◈ +15% All Damage rate &nbsp; ◈ Add Random Buff When Use Arcane Spell ,1,63,71,79,84,130,,,,,,0,100,511,103\n219,Mystic4,Mystic,◈ +7 All Stat &nbsp;  ◈ +18% All Damage rate &nbsp; ◈ Add Random Buff When Use Arcane Spell,1,64,72,80,85,131,,,,,,0,100,511,103\n220,Mystic5,Mystic,◈ +8 All Stat &nbsp;  ◈ +20% All Damage rate &nbsp; ◈ +15% Cooldown Reduce rate &nbsp; ◈ Add Random Buff When Use Arcane Spell,1,65,73,81,86,132,114,,,,,0,100,511,103\n221,RandomBuff1-1,MysticBuff1,◈ +50 HP Restore,1,133,,,,,,,,,,6000,100,511,1014\n222,RandomBuff1-2,MysticBuff1,◈ +30 MP Restore,1,134,,,,,,,,,,6000,100,511,1015\n223,RandomBuff1-3,MysticBuff1,◈ +15% Damage Rate,1,135,,,,,,,,,,6000,100,511,1016\n224,RandomBuff1-4,MysticBuff1,◈ +5% All Resistance,1,136,,,,,,,,,,6000,100,511,1017\n225,RandomBuff1-5,MysticBuff1,◈ +10% Move and Cast speed,1,35,47,,,,,,,,,6000,100,511,1018\n226,RandomBuff2-1,MysticBuff2,◈ +65 HP Restore,1,137,,,,,,,,,,7000,100,511,1014\n227,RandomBuff2-2,MysticBuff2,◈ +40 MP Restore,1,138,,,,,,,,,,7000,100,511,1015\n228,RandomBuff2-3,MysticBuff2,◈ +30% Damage Rate,1,139,,,,,,,,,,7000,100,511,1016\n229,RandomBuff2-4,MysticBuff2,◈ +10% All Resistance,1,140,,,,,,,,,,7000,100,511,1017\n230,RandomBuff2-5,MysticBuff2,◈ +15% Move and Cast speed,1,36,48,,,,,,,,,7000,100,511,1018\n231,RandomBuff3-1,MysticBuff3,◈ +80 HP Restore,1,141,,,,,,,,,,8000,100,511,1014\n232,RandomBuff3-2,MysticBuff3,◈ +50 MP Restore,1,142,,,,,,,,,,8000,100,511,1015\n233,RandomBuff3-3,MysticBuff3,◈ +45% Damage Rate,1,143,,,,,,,,,,8000,100,511,1016\n234,RandomBuff3-4,MysticBuff3,◈ +15% All Resistance,1,144,,,,,,,,,,8000,100,511,1017\n235,RandomBuff3-5,MysticBuff3,◈ +20% Move and Cast speed,1,38,50,,,,,,,,,8000,100,511,1018\n1000,StartBuff,Immortal,◈ Immortal ,1,145,146,147,,,,,,,,5000,100,512,1\n1001,LevelUPBuff,LevelUp,◈ Level Up!!! ,1,146,147,,,,,,,,,1000,100,512,1019\n1002,EnvImmortal,Immortal,◈ Immortal &nbsp;  ◈ You are totaly safe in here!,1,145,,,,,,,,,,0,100,512,1021\n1003,EnvPortal,,,1,149,145,,,,,,,,,1500,100,1002,1020\n1100,objBuffHeal,HP Heal,◈ +500 HP Restore &nbsp;  ◈ +300 MP Restore,1,150,151,,,,,,,,,300,100,514,1011\n1101,objBuffDamage,Damage Buff,◈ +50% Damage Rate,1,152,,,,,,,,,,10000,100,502,1001\n1102,objBuffSpeed,Speed,◈ +25% Move and Cast speed,1,42,54,,,,,,,,,10000,100,510,1006\n1103,objBuffDefence,Defence,◈ +30% All Resistance,1,153,,,,,,,,,,15000,100,509,1005\n1104,objBuffImmortal,Immortal,◈ Immortal ,1,145,,,,,,,,,,15000,100,512,1\n2000,onlyForEffect,,,1,148,,,,,,,,,,500,100,1002,1012\n",
  "chestData" : "index,grade,HP,imgData,provideGold,provideJewel,minGoldCount,maxGoldCount,minGoldAmount,maxGoldAmount,minJewelCount,maxJewelCount,minJewelAmount,maxJewelAmount,minSkillCount,maxSkillCount,SkillIndex1,SkillDropRate1,SkillIndex2,SkillDropRate2,SkillIndex3,SkillDropRate3,SkillIndex4,SkillDropRate4,SkillIndex5,SkillDropRate5,SkillIndex6,SkillDropRate6,SkillIndex7,SkillDropRate7,SkillIndex7,SkillDropRate7,SkillIndex8,SkillDropRate8,SkillIndex9,SkillDropRate9,SkillIndex10,SkillDropRate10,SkillIndex11,SkillDropRate11,SkillIndex12,SkillDropRate12,SkillIndex13,SkillDropRate13,SkillIndex14,SkillDropRate14,SkillIndex15,SkillDropRate15,SkillIndex16,SkillDropRate16,SkillIndex17,SkillDropRate17,SkillIndex18,SkillDropRate18,SkillIndex19,SkillDropRate19,SkillIndex20,SkillDropRate20\n1,1,2000,108,0,0,5,7,80,100,0,0,1,1,1,1,21,75,31,100,41,75,51,50,61,50,71,50,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n2,1,2000,108,0,0,5,7,80,100,0,0,1,1,1,1,1011,75,1021,100,1031,100,1041,75,1051,75,1061,50,1081,75,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n3,1,2000,108,0,0,5,7,80,100,0,0,1,1,1,1,2011,75,2021,50,2031,75,2041,50,2061,50,2071,50,2081,50,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n4,2,2500,109,0,0,6,7,80,120,0,0,1,1,1,1,41,75,51,50,61,50,71,50,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n5,2,2500,109,0,0,6,7,80,120,0,0,1,1,1,1,1041,75,1051,75,1061,50,1081,75,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n6,2,2500,109,0,0,6,7,80,120,0,0,1,1,1,1,2031,75,2041,50,2061,50,2071,50,2081,50,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n7,3,3500,110,0,0,7,8,100,200,0,1,1,1,1,1,41,75,51,50,61,50,71,50,81,25,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n8,3,3500,110,0,0,7,8,100,200,0,1,1,1,1,1,1041,75,1051,75,1061,50,1071,50,1081,75,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n9,3,3500,110,0,0,7,8,100,200,0,1,1,1,1,1,2031,75,2041,50,2061,50,2071,50,2081,50,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n10,4,4500,111,0,0,7,9,100,120,0,1,1,1,1,2,41,75,51,50,61,50,71,50,81,25,1041,75,1051,75,1061,50,1071,50,1081,75,,,,,,,,,,,,,,,,,,,,,,\n11,4,4500,111,0,0,7,9,100,120,0,1,1,1,1,2,1041,75,1051,75,1061,50,1071,50,2031,75,2041,50,2061,50,2071,50,2081,50,1081,75,,,,,,,,,,,,,,,,,,,,,,\n12,4,4500,111,0,0,7,9,100,120,0,1,1,1,1,2,2031,75,2041,50,2061,50,2071,50,2081,50,41,75,51,50,61,50,71,50,81,50,,,,,,,,,,,,,,,,,,,,,,\n13,5,6000,112,0,0,8,10,100,150,1,2,1,1,1,2,61,50,71,50,81,25,1061,50,1071,50,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n14,5,6000,112,0,0,8,10,100,150,1,2,1,1,1,2,1061,50,1071,50,2061,50,2071,50,2081,50,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n15,5,6000,112,0,0,8,10,100,150,1,2,1,1,1,2,2061,50,2071,50,2081,50,61,50,71,50,81,50,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n",
  "obstacleData" :
  "index,type,id,posX,posY,radius,treeImgRadius,imgData\n1,1,T1,896,1347,15,45,103\n2,1,T2,1095,1614,25,75,102\n3,1,T3,2653,1891,25,75,102\n4,1,T4,351,2149,25,75,102\n5,1,T5,2575,1035,25,75,102\n6,1,T6,1370,2882,25,75,102\n7,1,T7,1303,2346,25,75,102\n8,1,T8,598,1929,25,75,102\n9,1,T9,798,883,25,75,102\n10,1,T10,2537,1050,25,75,102\n11,1,T11,341,1201,25,75,102\n12,1,T12,2069,682,25,75,102\n13,1,T13,1299,561,25,75,102\n14,1,T14,1206,1461,25,75,102\n15,1,T15,2502,2801,30,90,101\n16,1,T16,1112,1638,30,90,101\n17,1,T17,621,2218,30,90,101\n18,1,T18,1531,799,30,90,101\n19,1,T19,1024,1522,30,90,101\n20,1,T20,1537,2430,30,90,101\n21,1,T21,2021,367,30,90,101\n22,1,T22,852,981,30,90,101\n23,1,T23,1353,1316,30,90,101\n24,1,T24,719,2895,30,90,101\n25,1,T25,1616,2114,30,90,101\n26,1,T26,2399,1989,30,90,101\n101,2,R1,2097,2100,50,,106\n102,2,R2,1578,1989,50,,106\n103,2,R3,841,724,50,,106\n104,2,R4,2798,1285,50,,106\n105,2,R5,359,1568,50,,106\n106,2,R6,1526,801,50,,106\n107,2,R7,1728,2187,50,,106\n108,2,R8,1585,2140,70,,105\n109,2,R9,1867,581,70,,105\n110,2,R10,887,887,70,,105\n111,2,R11,2644,967,70,,105\n112,2,R12,636,1683,70,,105\n113,2,R13,1135,2461,70,,105\n114,2,R14,867,691,70,,105\n115,2,R15,2892,2470,70,,105\n116,2,R16,2623,2252,70,,105\n117,2,R17,2003,1768,70,,105\n118,2,R18,2800,2700,50,,106\n119,2,R19,2900,2700,50,,106\n120,2,R20,3000,2700,50,,106\n121,2,R21,3100,2700,50,,106\n122,2,R22,2700,2800,50,,106\n123,2,R23,2700,2900,50,,106\n124,2,R24,2700,3000,50,,106\n125,2,R25,2700,3100,50,,106\n126,2,R26,2700,2700,50,,106\n201,3,D1,1000,2200,35,,113\n202,3,D2,2200,1000,35,,113\n203,4,I1,2850,2850,150,,206\n204,5,L1,2850,2850,20,,207\n"
  ,
  "resourceData" :
  "index,name,srcPosX,srcPosY,srcWidth,srcHeight,width,height\n1,pyroNovice,0,0,70,70,60,60\n2,pyroApprentice,70,0,70,70,61,61\n3,pyroAdept,140,0,70,70,63,63\n4,pyroExpert,210,0,70,70,64,64\n5,pyroMaster,280,0,70,70,65,65\n6,frosterNovice,0,70,70,70,60,60\n7,frosterApprentice,70,70,70,70,61,61\n8,frosterAdept,140,70,70,70,63,63\n9,frosterExpert,210,70,70,70,64,64\n10,frosterMaster,280,70,70,70,65,65\n11,mysterNovice,0,140,70,70,60,60\n12,mysterApprentice,70,140,70,70,61,61\n13,mysterAdept,140,140,70,70,63,63\n14,mysterExpert,210,140,70,70,64,64\n15,mysterMaster,280,140,70,70,65,65\n16,charHandIdle,0,210,120,100,120,100\n17,charHandCast1,120,210,120,100,120,100\n18,charHandCast2,240,210,120,100,120,100\n19,charHandCast3,360,210,120,100,120,100\n20,charHandCast4,480,210,120,100,120,100\n21,castEffectFire,0,310,120,100,120,100\n22,castEffectFrost,120,310,120,100,120,100\n23,castEffectArcane,240,310,120,100,120,100\n24,projectileFire,0,220,70,70,65,65\n25,projectileFrost,70,220,70,70,65,65\n26,projectileArcane,140,220,70,70,65,65\n27,skillEffectFire,0,290,160,160,155,155\n28,skillEffectFrost,160,290,160,160,155,155\n29,skillEffectArcane,320,290,160,160,155,155\n30,ranker1,455,5,60,60,60,60\n31,ranker2,515,5,60,60,60,60\n32,ranker3,575,5,60,60,60,60\n33,Goblin,0,500,120,100,84,70\n34,Orc,120,500,120,100,96,80\n35,OrcFighter,240,500,120,100,108,90\n100,projectileSkillArrow,0,410,240,80,240,80\n101,objTreeLarge,210,0,210,210,225,225\n102,objTreeMedium,210,0,210,210,185,185\n103,objTreeSmall,210,0,210,210,145,145\n104,objTreeInside,420,0,210,210,0,0\n105,objStoneLarge,0,0,210,210,165,165\n106,objStoneMedium,0,0,210,210,125,125\n107,objStoneSmall,0,0,210,210,85,85\n108,objChest1,0,210,90,90,85,85\n109,objChest2,90,210,90,90,85,85\n110,objChest3,180,210,90,90,85,85\n111,objChest4,270,210,90,90,85,85\n112,objChest5,360,210,90,90,85,85\n113,objChestGround,450,210,90,90,85,85\n200,objGold,0,300,70,70,65,65\n201,objJewel,70,300,70,70,65,65\n202,objSkillFire,0,370,70,70,65,65\n203,objSkillFrost,70,370,70,70,65,65\n204,objSkillArcane,140,370,70,70,65,65\n205,objBox,140,300,70,70,65,65\n206,envImmortal,0,90,150,150,150,150\n207,envPortal1,0,0,90,90,90,90\n208,envPortal2,90,0,90,90,90,90\n209,envPortal3,180,0,90,90,90,90\n210,envPortal4,270,0,90,90,90,90\n211,envPortal5,360,0,90,90,90,90\n212,objBuffHeal,70,440,70,70,65,65\n213,objBuffDamage,140,440,70,70,65,65\n214,objBuffSpeed,210,440,70,70,65,65\n215,objBuffDefence,280,440,70,70,65,65\n216,objBuffImmortal,350,440,70,70,65,65\n1001,conditionEffectFreeze,0,0,80,80,75,75\n1002,conditionEffectChill,80,0,80,80,75,75\n1003,conditionEffectImmortal,160,0,80,80,75,75\n1004,conditionEffectSilence,240,0,80,80,75,75\n1005,conditionEffectIgnite1,0,80,60,60,55,55\n1006,conditionEffectIgnite2,60,80,60,60,55,55\n1007,conditionEffectIgnite3,120,80,60,60,55,55\n1008,conditionEffectIgnite4,180,80,60,60,55,55\n1009,conditionEffectIgnite5,240,80,60,60,55,55\n1010,conditionEffectIgnite6,300,80,60,60,55,55\n1011,fireHitEffect,210,220,70,70,65,65\n1012,frostHitEffect,280,220,70,70,65,65\n1013,arcaneHitEffect,350,220,70,70,65,65\n1014,blankImg,0,450,60,60,55,55\n1015,passiveEffectFire1,60,450,60,60,60,60\n1016,passiveEffectFire2,120,450,60,60,65,65\n1017,passiveEffectFire3,180,450,60,60,70,70\n1018,passiveEffectFire4,240,450,60,60,75,75\n1019,passiveEffectFire5,300,450,60,60,80,80\n1020,passiveEffectFire6,360,450,60,60,85,85\n1021,passiveEffectFire7,420,450,60,60,90,90\n1022,passiveEffectFrost1,0,510,60,60,60,60\n1023,passiveEffectFrost2,60,510,60,60,65,65\n1024,passiveEffectFrost3,120,510,60,60,70,70\n1025,passiveEffectFrost4,180,510,60,60,75,75\n1026,passiveEffectFrost5,240,510,60,60,80,80\n1027,passiveEffectFrost6,300,510,60,60,85,85\n1028,passiveEffectFrost7,360,510,60,60,90,90\n1029,passiveEffectArcane1,480,450,60,60,60,60\n1030,passiveEffectArcane2,420,510,60,60,65,65\n1031,passiveEffectArcane3,480,510,60,60,70,70\n1032,passiveEffectArcane4,540,510,60,60,75,75\n1033,passiveEffectArcane5,600,510,60,60,80,80\n1034,passiveEffectArcane6,660,510,60,60,85,85\n1035,passiveEffectArcane7,720,510,60,60,90,90\n1036,fireSkillEffectInnerFire,0,140,80,80,80,80\n1037,fireSkillEffectFury1,80,140,80,80,80,80\n1038,fireSkillEffectFury2,80,140,80,80,83,83\n1039,fireSkillEffectFury3,80,140,80,80,86,86\n1040,fireSkillEffectFury4,80,140,80,80,90,90\n1041,fireSkillEffectFury5,80,140,80,80,85,88\n1042,frostSkillEffectPurify,160,140,80,80,70,70\n1043,frostSkillEffectIceBlock,240,140,80,80,90,90\n1044,arcaneSkillEffectCloak,320,140,80,80,90,90\n1045,arcaneSkillEffectHaste1,400,140,80,80,80,80\n1046,arcaneSkillEffectHaste2,400,140,80,80,83,83\n1047,arcaneSkillEffectHaste3,400,140,80,80,86,86\n1048,arcaneSkillEffectHaste4,400,140,80,80,90,90\n1049,arcaneSkillEffectHaste5,400,140,80,80,85,88\n1050,fireProjectileRollingFire,480,290,90,90,90,90\n1051,frostProjectileFrostOrb,570,290,90,90,90,90\n1052,arcaneSkillNoDamageExplosion,660,290,90,90,90,90\n1053,regenHP1,360,80,60,60,55,55\n1054,regenHP2,420,80,60,60,55,55\n1055,regenHP3,480,80,60,60,55,55\n1056,regenHP4,540,80,60,60,55,55\n1057,regenHP5,600,80,60,60,55,55\n1058,regenMP1,360,20,60,60,55,55\n1059,regenMP2,420,20,60,60,55,55\n1060,regenMP3,480,20,60,60,55,55\n1061,regenMP4,540,20,60,60,55,55\n1062,regenMP5,600,20,60,60,55,55\n1063,purifyAndHeal1,660,20,60,60,55,55\n1064,purifyAndHeal2,720,20,60,60,55,55\n1065,dispel1,480,140,60,60,55,55\n1066,dispel2,540,140,60,60,55,55\n1067,dispel3,600,140,60,60,55,55\n1068,dispel4,660,140,60,60,55,55\n1069,levelUp1,160,0,80,80,64,64\n1070,levelUp2,160,0,80,80,66,66\n1071,levelUp3,160,0,80,80,68,68\n1072,levelUp4,160,0,80,80,70,70\n1073,levelUp5,160,0,80,80,72,72\n1074,portalEffect1,575,375,80,80,120,120\n1075,portalEffect2,575,375,80,80,122,122\n1076,portalEffect3,575,375,80,80,124,124\n1077,portalEffect4,575,375,80,80,126,126\n1078,portalEffect5,575,375,80,80,128,128\n1079,portalEffect6,575,375,80,80,130,130\n1080,portalEffect7,575,375,80,80,128,128\n1081,portalEffect8,575,375,80,80,126,126\n1082,portalEffect9,575,375,80,80,124,124\n1083,portalEffect10,575,375,80,80,122,122\n"
  ,
  "iconResourceData" :
  "index,name,top,right,bottom,left\n1,Pyro Attack,0,72,72,0\n2,Fire Bolt,0,144,72,72\n3,Burning Soul,0,216,72,144\n4,Fire Ball,0,288,72,216\n5,Inner Fire,0,360,72,288\n6,Rolling Fire,0,432,72,360\n7,Fury,0,504,72,432\n8,Explosion,0,576,72,504\n9,Pyromaniac,0,648,72,576\n101,Froster Attack,72,72,144,0\n102,Ice Bolt,72,144,144,72\n103,Healing,72,216,144,144\n104,Frozen Soul,72,288,144,216\n105,Purify,72,360,144,288\n106,Ice Block,72,432,144,360\n107,Cold Snap,72,504,144,432\n108,Frozen Orb,72,576,144,504\n109,Freezer,72,648,144,576\n110,Ice Spear,72,720,144,648\n201,Myster Attack,144,72,216,0\n202,Arcane Bolt,144,144,216,72\n203,Arcane Cloak,144,216,216,144\n204,Arcane Missile,144,288,216,216\n205,Silence,144,360,216,288\n206,Dispel,144,432,216,360\n207,Blink,144,504,216,432\n208,Arcane Blast,144,576,216,504\n209,Haste,144,648,216,576\n210,Mystic,144,720,216,648\n501,Buff_Burning Soul,360,72,432,0\n502,Buff_Inner Fire,360,144,432,72\n503,Buff_Fury,360,216,432,144\n504,Buff_Pyromaniac,360,288,432,216\n505,Buff_Frozen Soul,360,360,432,288\n506,Buff_Purify,360,432,432,360\n507,Buff_Ice Block,360,504,432,432\n508,Buff_Freezer,360,576,432,504\n509,Buff_Arcane Cloak,432,72,504,0\n510,Buff_Haste,432,144,504,72\n511,Buff_Mystic,432,216,504,144\n512,Buff_Immortal,432,288,504,216\n513,Buff_Dispel,360,648,432,576\n514,Buff_Heal,360,720,432,648\n515,Debuff_Ignite,288,72,360,0\n516,Debuff_Chill,288,144,360,72\n517,Debuff_Freeze,288,216,360,144\n518,Debuff_Silence,288,288,360,216\n519,Debuff_Dispel,288,360,360,288\n1001,blankImg,216,72,288,0\n1002,whiteBlankImg,216,144,288,72\n"
  ,
  "effectGroupData" :
  "index,name,isRotate,rotateStartDegree,isAttach,isFront,resourceLifeTime,resourceIndex1,resourceIndex2,resourceIndex3,resourceIndex4,resourceIndex5,resourceIndex6,resourceIndex7,resourceIndex8,resourceIndex9,resourceIndex10\n1,Immortal,1,0,1,1,,1003,,,,,,,,,\n2,Chill,0,,1,1,,1002,,,,,,,,,\n3,Freeze,0,,1,1,,1001,,,,,,,,,\n4,Silence,0,,1,1,,1004,,,,,,,,,\n5,Ignite,0,,0,0,300,1005,1006,1007,1008,1009,1010,,,,\n6,fireHitEffect,0,,1,1,100,1011,,,,,,,,,\n7,frostHitEffect,0,,1,1,100,1012,,,,,,,,,\n8,arcaneHitEffect,0,,1,1,100,1013,,,,,,,,,\n101,firePassive,0,,1,0,,1014,1014,1014,1015,1016,1017,1018,1019,1020,1021\n102,frostPassive,0,,1,0,,1014,1014,1014,1022,1023,1024,1025,1026,1027,1028\n103,arcanePassive,1,0,1,0,,1014,1014,1014,1029,1030,1031,1032,1033,1034,1035\n1001,fireSkillEffectInnerFire,1,0,1,0,,1036,,,,,,,,,\n1002,fireSkillEffectFury,0,,1,0,,1037,1038,1039,1040,1041,1040,1039,1038,1037,1037\n1003,frostSkillEffectPurify,1,0,1,1,,1042,,,,,,,,,\n1004,frostSkillEffectIceBlock,1,0,1,1,,1043,,,,,,,,,\n1005,arcaneSkillEffectCloak,1,0,1,0,,1044,,,,,,,,,\n1006,arcaneSkillEffectHaste,1,0,1,0,,1048,1047,1046,1045,1045,1045,1046,1047,1048,1049\n1007,fireProjectileRollingFire,1,0,0,1,,1050,,,,,,,,,\n1008,frostProjectileFrostOrb,1,0,0,1,,1051,,,,,,,,,\n1009,arcaneSkillNoDamageExplosion,0,,0,1,,1052,,,,,,,,,\n1010,regenHP,0,,1,1,,1054,1053,1054,1055,1056,1057,1014,1014,1014,1014\n1011,regenMP,0,,1,1,,1014,1014,1014,1014,1059,1058,1059,1060,1061,1062\n1012,purifyAndHeal,0,,1,1,,1063,1064,1063,1058,1059,,,,,\n1013,dispel,0,,1,1,,1066,1065,1066,1067,1068,,,,,\n1014,mysticRegenHP,0,,1,1,,1014,1014,1054,1053,1054,1055,1056,1057,1014,1014\n1015,mysticRegenMP,0,,1,1,,1014,1059,1058,1059,1060,1061,1062,1014,1014,1014\n1016,mysticInnerFire,1,180,1,0,,1036,,,,,,,,,\n1017,mysticCloak,1,180,1,0,,1044,,,,,,,,,\n1018,mysticHaste,1,0,1,0,,1045,1045,1046,1047,1048,1049,1048,1047,1046,1045\n1019,levelUp,1,0,1,1,,1069,1070,1071,1072,1073,1072,1071,1070,1069,\n1020,Portal,1,0,1,1,1000,1074,1075,1076,1077,1078,1079,1080,1081,1082,1083\n1021,ImmortalZone,1,0,1,0,,1003,,,,,,,,,\n"
  ,
  "mobData" : "index,name,mobName,size,moveSpeed,rotateSpeed,attackTime,maxHP,damage,resistAll,attackRange,maxHitRange,resourceIndex,dropIndex,imgRatio\n1,Goblin1,Goblin,45,170,360,200,800,20,0,50,500,33,1,70\n2,Goblin2,Goblin,45,170,360,200,800,20,0,50,500,33,2,70\n3,Goblin3,Goblin,45,170,360,200,800,20,0,50,500,33,3,70\n4,Orc1,Orc,50,160,360,200,3300,50,10,60,550,34,4,80\n5,Orc2,Orc,50,160,360,200,3300,50,10,60,550,34,5,80\n6,Orc3,Orc,50,160,360,200,3300,50,10,60,550,34,6,80\n7,OrcFighter1,OrcFighter,55,155,360,180,5500,120,20,60,600,35,7,90\n8,OrcFighter2,OrcFighter,55,155,360,180,5500,120,20,60,600,35,8,90\n9,OrcFighter3,OrcFighter,55,155,360,180,5500,120,20,60,600,35,9,90\n",
  "objBuffData" : "index,name,buffGroupIndex,resourceIndex\n1,Heal,1100,212\n2,Damage,1101,213\n3,Speed,1102,214\n4,Defence,1103,215\n5,Immortal,1104,216\n"
}

},{}],13:[function(require,module,exports){
module.exports={
  "GAME_VERSION" : "1.1.0",
  "MAX_SERVER_RESPONSE_TIME" : 5000,
  "LIMIT_NO_ACTION_TIME" : 1200000,
  "LONG_TIME_INTERVAL" : 300000,
  "MAX_PING_LIMIT" : 1000,
  "INTERVAL" : 60,
  "FPS" : 60,
  "MAX_FIND_AVAILABLE_SERVER_TIME" : 7000,

  "RESOURCES_COUNT" : 5,
  "RESOURCE_SRC_CHARACTER" : "../images/Character.png",
  "RESOURCE_SRC_OBJECT" : "../images/Objects.png",
  "RESOURCE_SRC_SKILL_EFFECT" : "../images/SkillEffect.png",
  "RESOURCE_SRC_ENVIRONMENT" : "../images/Environment.png",
  "RESOURCE_SRC_UI" : "../images/UI.png",

  "MINIMAP_CHEST_GROUND_SRC" : "../images/chestGround.png",
  "MINIMAP_CHEST_SRC_1" : "../images/chest1.png",
  "MINIMAP_CHEST_SRC_2" : "../images/chest2.png",
  "MINIMAP_CHEST_SRC_3" : "../images/chest3.png",
  "MINIMAP_VOID_SRC" : "../images/void.png",

  "START_BUTTON" : 1,
  "RESTART_BUTTON" : 2,

  "MINIMUM_LOADING_TIME" : 2000,
  "CHANGE_LOADING_TEXT_TIME" : 500,
  "SKILL_INFORM_TIME" : 150,
  "SKILL_HIT_EFFECT_TIME" : 100,
  "USER_ATTACH_EFFECT_CHANGE_TIME" : 150,
  "USER_DETACH_EFFECT_CHANGE_TIME" : 50,
  "USER_DETACH_EFFECT_MAKE_TIME" : 200,
  "RISE_TEXT_LIFE_TIME" : 3000,
  "PROJECTILE_EFFECT_CHANGE_TIME" : 150,
  "CHAT_MESSAGE_TIME" : 5000,

  "USER_BODY_SIZE" : 64,
  "USER_NICK_NAME_LENGTH" : 15,
  "CHAT_MESSAGE_LENGTH" : 25,

  "CAST_EFFECT_INTERPOLATION_FACTOR" : 0.1,
  "SKILL_EFFECT_INTERPOLATION_FACTOR" : 0.6,
  "USER_ANI_TIME" : 500,
  "IMG_COLLISION_CLEAR_TIME" : 200,

  "CANVAS_MAX_SIZE" : {"width" : 3200, "height" : 3200},
  "CANVAS_MAX_LOCAL_SIZE" : {"width" : 1600, "height" : 1000},

  "IMAGE_SOURCE_SIZE" : {"width" : 800, "height" : 600},

  "DRAW_MODE_NORMAL" : 1,
  "DRAW_MODE_SKILL_RANGE" : 2,

  "SKILL_CHANGE_PANEL_CONTAINER" : 1,
  "SKILL_CHANGE_PANEL_EQUIP" : 2,

  "OBJECT_STATE_IDLE" : 1,
  "OBJECT_STATE_MOVE" : 2,
  "OBJECT_STATE_ATTACK" : 3,
  "OBJECT_STATE_CAST" : 4,
  "OBJECT_STATE_DEATH" : 5,
  "OBJECT_STATE_MOVE_AND_ATTACK" : 6,

  "MOVE_SLIGHT_RATE" : 0.6,
  "MOVE_BACK_WARD_SPEED_DECREASE_RATE" : 0.5,

  "GAME_STATE_LOAD" : 1,
  "GAME_STATE_START_SCENE" : 2,
  "GAME_STATE_GAME_START" : 3,
  "GAME_STATE_GAME_ON" : 4,
  "GAME_STATE_GAME_END" : 5,
  "GAME_STATE_RESTART_SCENE" : 6,
  "GAME_STATE_RESTART" : 7,

  "CHAR_TYPE_FIRE" : 1,
  "CHAR_TYPE_FROST" : 2,
  "CHAR_TYPE_ARCANE" : 3,
  "CHAR_TYPE_MOB" : 4,

  "PREFIX_USER" : "U",
  "PREFIX_MONSTER" : "M",
  "PREFIX_SKILL" : "S",
  "PREFIX_SKILL_PROJECTILE" : "P",
  "PREFIX_CHEST" : "C",
  "PREFIX_OBSTACLE_TREE" : "T",
  "PREFIX_OBSTACLE_ROCK" : "R",
  "PREFIX_OBSTACLE_CHEST_GROUND" : "D",
  "PREFIX_OBJECT_EXP" : "E",
  "PREFIX_OBJECT_SKILL" : "K",
  "PREFIX_OBJECT_GOLD" : "G",
  "PREFIX_OBJECT_JEWEL" : "J",
  "PREFIX_OBJECT_BOX" : "X",
  "PREFIX_OBJECT_BUFF" : "B",
  "PREFIX_ENVIRONMENT_IMMORTAL_GROUND" : "I",
  "PREFIX_ENVIRONMENT_PORTAL" : "L",

  "USER_CONDITION_IMMORTAL" : 1,
  "USER_CONDITION_CHILL" : 2,
  "USER_CONDITION_FREEZE" : 3,
  "USER_CONDITION_SILENCE" : 4,
  "USER_CONDITION_IGNITE" : 5,
  "USER_CONDITION_BLUR" : 6,

  "SKILL_PROPERTY_FIRE" : 1,
  "SKILL_PROPERTY_FROST" : 2,
  "SKILL_PROPERTY_ARCANE" : 3,

  "SKILL_INDEX_PYRO_BASE" : 11,
  "SKILL_INDEX_PYRO_PASSIVE" : 91,
  "SKILL_INDEX_PYRO_GIVEN": 21,
  "SKILL_INDEX_FROST_BASE" : 1001,
  "SKILL_INDEX_FROST_PASSIVE" : 1091,
  "SKILL_INDEX_FROST_GIVEN": 1011,
  "SKILL_INDEX_ARCANE_BASE" : 2001,
  "SKILL_INDEX_ARCANE_PASSIVE" : 2091,
  "SKILL_INDEX_ARCANE_GIVEN" : 2011,

  "TUTORIAL_SKILL_FIRE_INDEX" : 41,
  "TUTORIAL_SKILL_FROST_INDEX" : 1021,
  "TUTORIAL_SKILL_ARCANE_INDEX" : 2021,

  "SKILL_TYPE_INSTANT_RANGE" : 1,
  "SKILL_TYPE_INSTANT_PROJECTILE" : 2,
  "SKILL_TYPE_PROJECTILE" : 3,
  "SKILL_TYPE_PROJECTILE_EXPLOSION" : 4,
  "SKILL_TYPE_PROJECTILE_TICK" : 5,
  "SKILL_TYPE_PROJECTILE_TICK_EXPLOSION" : 6,
  "SKILL_TYPE_RANGE" : 7,
  "SKILL_TYPE_SELF" : 8,
  "SKILL_TYPE_SELF_EXPLOSION" : 9,
  "SKILL_TYPE_TELEPORT" : 10,
  "SKILL_TYPE_PASSIVE" : 11,

  "SKILL_BASIC_INDEX" : 1,
  "SKILL_EQUIP1_INDEX" : 2,
  "SKILL_EQUIP2_INDEX" : 3,
  "SKILL_EQUIP3_INDEX" : 4,
  "SKILL_EQUIP4_INDEX" : 5,
  "SKILL_PASSIVE_INDEX" : 6,

  "STAT_POWER_INDEX" : 1,
  "STAT_MAGIC_INDEX" : 2,
  "STAT_SPEED_INDEX" : 3,
  "STAT_OFFENCE_INDEX" : 4,
  "STAT_DEFENCE_INDEX" : 5,

  "PROJECTILE_FIRE_DISTANCE" : 20,
  "MULTI_PROJECTILE_DEGREE" : 15,

  "OBJ_SKILL_RADIUS" : 20,
  "OBJ_JEWEL_RADIUS" : 20,
  "OBJ_BOX_RADIUS" : 23,
  "OBJ_BUFF_RADIUS" : 25,

  "GET_RESOURCE_TYPE_GOLD" : 1,
  "GET_RESOURCE_TYPE_JEWEL" : 2,
  "GET_RESOURCE_TYPE_EXP" : 3,

  "OBJ_TYPE_TREE" : 1,
  "OBJ_TYPE_ROCK" : 2,
  "OBJ_TYPE_CHEST_GROUND" : 3,
  "ENV_TYPE_IMMORTAL_GROUND" : 4,
  "ENV_TYPE_PORTAL" : 5,

  "RESOURCE_INDEX_USER_HAND_1" : 16,
  "RESOURCE_INDEX_USER_HAND_2" : 17,
  "RESOURCE_INDEX_USER_HAND_3" : 18,
  "RESOURCE_INDEX_USER_HAND_4" : 19,
  "RESOURCE_INDEX_USER_HAND_5" : 20,

  "RESOURCE_INDEX_CASTING_FIRE" : 21,
  "RESOURCE_INDEX_CASTING_FROST" : 22,
  "RESOURCE_INDEX_CASTING_ARCANE" : 23,

  "RESOURCE_INDEX_PROJECTILE_FIRE" : 24,
  "RESOURCE_INDEX_PROJECTILE_FROST" : 25,
  "RESOURCE_INDEX_PROJECTILE_ARCANE" : 26,

  "RESOURCE_INDEX_SKILL_EFFECT_FIRE" : 27,
  "RESOURCE_INDEX_SKILL_EFFECT_FROST" : 28,
  "RESOURCE_INDEX_SKILL_EFFECT_ARCANE" : 29,

  "RESOURCE_INDEX_RANK_1" : 30,
  "RESOURCE_INDEX_RANK_2" : 31,
  "RESOURCE_INDEX_RANK_3" : 32,

  "RESOURCE_INDEX_PORTAL_1" : 207,
  "RESOURCE_INDEX_PORTAL_2" : 208,
  "RESOURCE_INDEX_PORTAL_3" : 209,
  "RESOURCE_INDEX_PORTAL_4" : 210,
  "RESOURCE_INDEX_PORTAL_5" : 211,

  "RESOURCE_INDEX_PROJECTILE_SKILL_ARROW" : 100,

  "RESOURCE_INDEX_OBSTACLE_TREE_INSIDE" : 104,

  "RESOURCE_INDEX_OBJ_GOLD" : 200,
  "RESOURCE_INDEX_OBJ_JEWEL" : 201,
  "RESOURCE_INDEX_OBJ_BOX" : 205,
  "RESOURCE_INDEX_OBJ_SKILL_FIRE" : 202,
  "RESOURCE_INDEX_OBJ_SKILL_FROST" : 203,
  "RESOURCE_INDEX_OBJ_SKILL_ARCANE" : 204,

  "RESOURCE_INDEX_CHEST_GRADE_1" : 108,
  "RESOURCE_INDEX_CHEST_GRADE_2" : 109,
  "RESOURCE_INDEX_CHEST_GRADE_3" : 110,
  "RESOURCE_INDEX_CHEST_GRADE_4" : 111,
  "RESOURCE_INDEX_CHEST_GRADE_5" : 112,

  "UI_RESOURCE_INDEX_BLANK" : 1001,

  "STAT_CALC_FACTOR_POWER_TO_DAMAGE_RATE" : 0.5,
  "STAT_CALC_FACTOR_POWER_TO_HP" : 25,
  "STAT_CALC_FACTOR_POWER_TO_HP_REGEN" : 0.05,

  "STAT_CALC_FACTOR_MAGIC_TO_RESISTANCE" : 0.25,
  "STAT_CALC_FACTOR_MAGIC_TO_MP" : 15,
  "STAT_CALC_FACTOR_MAGIC_TO_MP_REGEN" : 0.03,

  "STAT_CALC_FACTOR_SPEED_TO_CAST_SPEED" : 0.25,
  "STAT_CALC_FACTOR_SPEED_TO_COOLDOWN_REDUCE_RATE" : 0.25,

  "MTYPE_REQ_START_GAME" : 1,
  "MTYPE_REQ_RESTART_GAME" : 2,
  "MTYPE_REQ_RECONNECT" : 3,
  "MTYPE_RECONNECT_SUCCESS" : 4,
  "MTYPE_NEED_RECONNECT" : 5,
  "MTYPE_USER_DATA_UPDATE" : 6,
  "MTYPE_USER_MOVE_START" : 7,
  "MTYPE_USER_MOVE_AND_ATTACK" : 8,
  "MTYPE_USER_USE_SKILL" : 9,
  "MTYPE_USER_STOP" : 10,
  "MTYPE_SKILL_FIRED" : 11,
  "MTYPE_PROJECTILE_FIRED" : 12,
  "MTYPE_UPGRADE_SKILL" : 13,
  "MTYPE_EXCHANGE_PASSIVE" : 14,
  "MTYPE_EQUIP_PASSIVE" : 15,
  "MTYPE_UNEQUIP_PASSIVE" : 16,
  "MTYPE_FIRE_PING" : 17,
  "MTYPE_CHATTING" : 18,
  "MTYPE_UPDATE_USER_TIME_DIFF" : 19,
  "MTYPE_UPDATE_EQUIP_SKILLS" : 20,
  "MTYPE_KILL_ME" : 21,
  "MTYPE_GIVE_EXP" : 22,
  "MTYPE_GIVE_RESOURCES" : 23,
  "MTYPE_GIVE_ALL_SKILL" : 24,

  "MTYPE_SYNC_SUCCESS" : 25,
  "MTYPE_DONT_CHEAT" : 26,
  "MTYPE_REQ_RECONNECT_RES" : 27,
  "MTYPE_RES_RECONNECT" : 28,
  "MTYPE_ADMIN_MESSAGE" : 29,
  "MTYPE_DOWN_SERVER" : 30,
  "MTYPE_NOW_SERVER_IS_DOWN" : 31,
  "MTYPE_CANCEL_SERVER_DOWN" : 32,
  "MTYPE_FIRE_PONG" : 33,
  "MTYPE_SYNC_AND_SET_SKILLS" : 34,
  "MTYPE_RES_START_GAME" : 35,
  "MTYPE_RES_RESTART_GAME" : 36,
  "MTYPE_USER_JOINED" : 37,
  "MTYPE_USER_DATA_SYNC" : 38,
  "MTYPE_USER_DATA_UPDATE_AND_USER_SKILL" : 39,
  "MTYPE_MOVE_USER_TO_NEW_POS" : 40,
  "MTYPE_UPDATE_USER_PRIVATE_STAT" : 41,
  "MTYPE_DELETE_PROJECTILE" : 42,
  "MTYPE_EXPLODE_PROJECTILE" : 43,
  "MTYPE_CREATE_OBJS" : 44,
  "MTYPE_DELETE_OBJS" : 45,
  "MTYPE_CREATE_CHEST" : 46,
  "MTYPE_CHEST_DAMAGED" : 47,
  "MTYPE_DELETE_CHEST" : 48,
  "MTYPE_GET_RESOURCE" : 49,
  "MTYPE_GET_SKILL" : 50,
  "MTYPE_SKILL_CHANGE_TO_RESOURCE" : 51,
  "MTYPE_CHANGE_USER_STAT" : 52,
  "MTYPE_USER_DAMAGED" : 53,
  "MTYPE_UPDATE_BUFF" : 54,
  "MTYPE_UPDATE_RANK" : 55,
  "MTYPE_USER_DEAD" : 56,
  "MTYPE_USER_LEAVE" : 57,
  "MTYPE_MOB_CREATED" : 58,
  "MTYPE_MOB_CHANGE_STATE" : 59,
  "MTYPE_MOB_TAKE_DAMAGE" : 60,
  "MTYPE_MOB_UPDATE_BUFF" : 61,
  "MTYPE_MOB_DEAD" :62,
  "MTYPE_ERROR_SET_ID" : 63,
  "MTYPE_DUPLICATE_ACCESS" : 64,

  "KILL_FEEDBACK_LEVEL_0" : 1,
  "KILL_FEEDBACK_LEVEL_1" : 2,
  "KILL_FEEDBACK_LEVEL_1_PREFIX" : "Gorgeous",
  "KILL_FEEDBACK_LEVEL_1_COLOR" : "#f5ebb6",
  "KILL_FEEDBACK_LEVEL_2" : 3,
  "KILL_FEEDBACK_LEVEL_2_PREFIX" : "Amazing",
  "KILL_FEEDBACK_LEVEL_2_COLOR" : "#f5e489",
  "KILL_FEEDBACK_LEVEL_3" : 4,
  "KILL_FEEDBACK_LEVEL_3_PREFIX" : "Incredible",
  "KILL_FEEDBACK_LEVEL_3_COLOR" : "#f7de57",
  "KILL_FEEDBACK_LEVEL_4" : 5,
  "KILL_FEEDBACK_LEVEL_4_PREFIX" : "Heroic",
  "KILL_FEEDBACK_LEVEL_4_COLOR" : "#f9dc3e",
  "KILL_FEEDBACK_LEVEL_5" : 6,
  "KILL_FEEDBACK_LEVEL_5_PREFIX" : "Legendary",
  "KILL_FEEDBACK_LEVEL_5_COLOR" : "#fbda25",
  "KILL_FEEDBACK_LEVEL_6" : 7,
  "KILL_FEEDBACK_LEVEL_6_PREFIX" : "Mythic",
  "KILL_FEEDBACK_LEVEL_6_COLOR" : "#f9d511",
  "KILL_FEEDBACK_LEVEL_7" : 8,
  "KILL_FEEDBACK_LEVEL_7_PREFIX" : "Godlike",
  "KILL_FEEDBACK_LEVEL_7_COLOR" : "#ffd700"
}

},{}],14:[function(require,module,exports){
module.exports={
  "backspace" : "8",
  "tab" : "9",
  "enter" : "13",
  "shift" : "16",
  "ctrl" : "17",
  "alt" : "18",
  "pause_break" : "19",
  "caps_lock" : "20",
  "escape" : "27",
  "page_up" : "33",
  "page down" : "34",
  "end" : "35",
  "home" : "36",
  "left_arrow" : "37",
  "up_arrow" : "38",
  "right_arrow" : "39",
  "down_arrow" : "40",
  "insert" : "45",
  "delete" : "46",
  "0" : "48",
  "1" : "49",
  "2" : "50",
  "3" : "51",
  "4" : "52",
  "5" : "53",
  "6" : "54",
  "7" : "55",
  "8" : "56",
  "9" : "57",
  "a" : "65",
  "b" : "66",
  "c" : "67",
  "d" : "68",
  "e" : "69",
  "f" : "70",
  "g" : "71",
  "h" : "72",
  "i" : "73",
  "j" : "74",
  "k" : "75",
  "l" : "76",
  "m" : "77",
  "n" : "78",
  "o" : "79",
  "p" : "80",
  "q" : "81",
  "r" : "82",
  "s" : "83",
  "t" : "84",
  "u" : "85",
  "v" : "86",
  "w" : "87",
  "x" : "88",
  "y" : "89",
  "z" : "90",
  "left_window key" : "91",
  "right_window key" : "92",
  "select_key" : "93",
  "numpad 0" : "96",
  "numpad 1" : "97",
  "numpad 2" : "98",
  "numpad 3" : "99",
  "numpad 4" : "100",
  "numpad 5" : "101",
  "numpad 6" : "102",
  "numpad 7" : "103",
  "numpad 8" : "104",
  "numpad 9" : "105",
  "multiply" : "106",
  "add" : "107",
  "subtract" : "109",
  "decimal point" : "110",
  "divide" : "111",
  "f1" : "112",
  "f2" : "113",
  "f3" : "114",
  "f4" : "115",
  "f5" : "116",
  "f6" : "117",
  "f7" : "118",
  "f8" : "119",
  "f9" : "120",
  "f10" : "121",
  "f11" : "122",
  "f12" : "123",
  "num_lock" : "144",
  "scroll_lock" : "145",
  "semi_colon" : "186",
  "equal_sign" : "187",
  "comma" : "188",
  "dash" : "189",
  "period" : "190",
  "forward_slash" : "191",
  "grave_accent" : "192",
  "open_bracket" : "219",
  "backslash" : "220",
  "closebracket" : "221",
  "single_quote" : "222",
  "space" : "32"
}

},{}],15:[function(require,module,exports){
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

'use strict';
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],16:[function(require,module,exports){
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    return define([], factory);
  } else if (typeof exports === 'object' && module.exports) {
    return module.exports = factory();
  } else {
    return root['Quadtree'] = factory();
  }
})(this, (function() {
  var Quadtree;

  var isInteger = Number.isInteger || function (x) {
    return typeof x === "number" && isFinite(x) && Math.floor(x) === x;
  };

  return Quadtree = (function() {
    var boundingBoxCollision, calculateDirection, fitting, getCenter, observe, splitTree, unobserve, validateElement;

    function Quadtree(arg) {
      var child, that;
      this.x = arg.x, this.y = arg.y, this.width = arg.width, this.height = arg.height, this.maxElements = arg.maxElements;
      if ((this.width == null) || (this.height == null)) {
        throw new Error('Missing quadtree dimensions.');
      }
      if (this.x == null) {
        this.x = 0;
      }
      if (this.y == null) {
        this.y = 0;
      }
      if (this.maxElements == null) {
        this.maxElements = 1;
      }
      this.contents = [];
      this.oversized = [];
      this.size = 0;
      if (this.width < 1 || this.height < 1) {
        throw new Error('Dimensions must be positive integers.');
      }
      if (!isInteger(this.x) || !isInteger(this.y)) {
        throw new Error('Coordinates must be integers');
      }
      if (this.maxElements < 1) {
        throw new Error('The maximum number of elements before a split must be a positive integer.');
      }
      that = this;
      this.children = {
        NW: {
          create: function() {
            return new Quadtree({
              x: that.x,
              y: that.y,
              width: Math.max(Math.floor(that.width / 2), 1),
              height: Math.max(Math.floor(that.height / 2), 1),
              maxElements: that.maxElements
            });
          },
          tree: null
        },
        NE: {
          create: function() {
            return new Quadtree({
              x: that.x + Math.max(Math.floor(that.width / 2), 1),
              y: that.y,
              width: Math.ceil(that.width / 2),
              height: Math.max(Math.floor(that.height / 2), 1),
              maxElements: that.maxElements
            });
          },
          tree: null
        },
        SW: {
          create: function() {
            return new Quadtree({
              x: that.x,
              y: that.y + Math.max(Math.floor(that.height / 2), 1),
              width: Math.max(Math.floor(that.width / 2), 1),
              height: Math.ceil(that.height / 2),
              maxElements: that.maxElements
            });
          },
          tree: null
        },
        SE: {
          create: function() {
            return new Quadtree({
              x: that.x + Math.max(Math.floor(that.width / 2), 1),
              y: that.y + Math.max(Math.floor(that.height / 2), 1),
              width: Math.ceil(that.width / 2),
              height: Math.ceil(that.height / 2),
              maxElements: that.maxElements
            });
          },
          tree: null
        }
      };
      for (child in this.children) {
        this.children[child].get = function() {
          if (this.tree != null) {
            return this.tree;
          } else {
            this.tree = this.create();
            return this.tree;
          }
        };
      }
    }

    getCenter = function(item) {
      var ref, ref1;
      return {
        x: Math.floor(((ref = item.width) != null ? ref : 1) / 2) + item.x,
        y: Math.floor(((ref1 = item.height) != null ? ref1 : 1) / 2) + item.y
      };
    };

    boundingBoxCollision = function(elt1, elt2) {
      var ref, ref1, ref2, ref3;
      return !(elt1.x >= elt2.x + ((ref = elt2.width) != null ? ref : 1) || elt1.x + ((ref1 = elt1.width) != null ? ref1 : 1) <= elt2.x || elt1.y >= elt2.y + ((ref2 = elt2.height) != null ? ref2 : 1) || elt1.y + ((ref3 = elt1.height) != null ? ref3 : 1) <= elt2.y);
    };

    calculateDirection = function(element, tree) {
      var quadCenter;
      quadCenter = getCenter(tree);
      if (element.x < quadCenter.x) {
        if (element.y < quadCenter.y) {
          return 'NW';
        } else {
          return 'SW';
        }
      } else {
        if (element.y < quadCenter.y) {
          return 'NE';
        } else {
          return 'SE';
        }
      }
    };

    validateElement = function(element) {
      if (!(typeof element === 'object')) {
        throw new Error('Element must be an Object.');
      }
      if ((element.x == null) || (element.y == null)) {
        throw new Error('Coordinates properties are missing.');
      }
      if ((element != null ? element.width : void 0) < 0 || (element != null ? element.height : void 0) < 0) {
        throw new Error('Width and height must be positive integers.');
      }
    };

    splitTree = function(tree) {
      var bottomHeight, leftWidth, rightWidth, topHeight;
      leftWidth = Math.max(Math.floor(tree.width / 2), 1);
      rightWidth = Math.ceil(tree.width / 2);
      topHeight = Math.max(Math.floor(tree.height / 2), 1);
      bottomHeight = Math.ceil(tree.height / 2);
      return {
        NW: {
          x: tree.x,
          y: tree.y,
          width: leftWidth,
          height: topHeight
        },
        NE: {
          x: tree.x + leftWidth,
          y: tree.y,
          width: rightWidth,
          height: topHeight
        },
        SW: {
          x: tree.x,
          y: tree.y + topHeight,
          width: leftWidth,
          height: bottomHeight
        },
        SE: {
          x: tree.x + leftWidth,
          y: tree.y + topHeight,
          width: rightWidth,
          height: bottomHeight
        }
      };
    };

    fitting = function(element, tree) {
      var coordinates, direction, ref, where;
      where = [];
      ref = splitTree(tree);
      for (direction in ref) {
        coordinates = ref[direction];
        if (boundingBoxCollision(element, coordinates)) {
          where.push(direction);
        }
      }
      return where;
    };

    observe = function(item, tree) {
      var writeAccessors;
      writeAccessors = function(propName) {
        item["_" + propName] = item[propName];
        return Object.defineProperty(item, propName, {
          set: function(val) {
            tree.remove(this, true);
            this["_" + propName] = val;
            return tree.push(this);
          },
          get: function() {
            return this["_" + propName];
          },
          configurable: true
        });
      };
      writeAccessors('x');
      writeAccessors('y');
      writeAccessors('width');
      return writeAccessors('height');
    };

    unobserve = function(item) {
      var unwriteAccessors;
      unwriteAccessors = function(propName) {
        if (item["_" + propName] == null) {
          return;
        }
        delete item[propName];
        item[propName] = item["_" + propName];
        return delete item["_" + propName];
      };
      unwriteAccessors('x');
      unwriteAccessors('y');
      unwriteAccessors('width');
      return unwriteAccessors('height');
    };

    Quadtree.prototype.push = function(item, doObserve) {
      return this.pushAll([item], doObserve);
    };

    Quadtree.prototype.pushAll = function(items, doObserve) {
      var candidate, content, contentDir, direction, element, elements, fifo, fifoCandidates, fits, item, j, k, l, len, len1, len2, ref, ref1, relatedChild, tree;
      for (j = 0, len = items.length; j < len; j++) {
        item = items[j];
        validateElement(item);
        if (doObserve) {
          observe(item, this);
        }
      }
      fifo = [
        {
          tree: this,
          elements: items
        }
      ];
      while (fifo.length > 0) {
        ref = fifo.shift(), tree = ref.tree, elements = ref.elements;
        fifoCandidates = {
          NW: null,
          NE: null,
          SW: null,
          SE: null
        };
        for (k = 0, len1 = elements.length; k < len1; k++) {
          element = elements[k];
          tree.size++;
          fits = fitting(element, tree);
          if (fits.length !== 1 || tree.width === 1 || tree.height === 1) {
            tree.oversized.push(element);
          } else if ((tree.size - tree.oversized.length) <= tree.maxElements) {
            tree.contents.push(element);
          } else {
            direction = fits[0];
            relatedChild = tree.children[direction];
            if (fifoCandidates[direction] == null) {
              fifoCandidates[direction] = {
                tree: relatedChild.get(),
                elements: []
              };
            }
            fifoCandidates[direction].elements.push(element);
            ref1 = tree.contents;
            for (l = 0, len2 = ref1.length; l < len2; l++) {
              content = ref1[l];
              contentDir = (fitting(content, tree))[0];
              if (fifoCandidates[contentDir] == null) {
                fifoCandidates[contentDir] = {
                  tree: tree.children[contentDir].get(),
                  elements: []
                };
              }
              fifoCandidates[contentDir].elements.push(content);
            }
            tree.contents = [];
          }
        }
        for (direction in fifoCandidates) {
          candidate = fifoCandidates[direction];
          if (candidate != null) {
            fifo.push(candidate);
          }
        }
      }
      return this;
    };

    Quadtree.prototype.remove = function(item, stillObserve) {
      var index, relatedChild;
      validateElement(item);
      index = this.oversized.indexOf(item);
      if (index > -1) {
        this.oversized.splice(index, 1);
        this.size--;
        if (!stillObserve) {
          unobserve(item);
        }
        return true;
      }
      index = this.contents.indexOf(item);
      if (index > -1) {
        this.contents.splice(index, 1);
        this.size--;
        if (!stillObserve) {
          unobserve(item);
        }
        return true;
      }
      relatedChild = this.children[calculateDirection(item, this)];
      if ((relatedChild.tree != null) && relatedChild.tree.remove(item, stillObserve)) {
        this.size--;
        if (relatedChild.tree.size === 0) {
          relatedChild.tree = null;
        }
        return true;
      }
      return false;
    };

    Quadtree.prototype.colliding = function(item, collisionFunction) {
      var child, elt, fifo, fits, items, j, k, l, len, len1, len2, ref, ref1, top;
      if (collisionFunction == null) {
        collisionFunction = boundingBoxCollision;
      }
      validateElement(item);
      items = [];
      fifo = [this];
      while (fifo.length > 0) {
        top = fifo.shift();
        ref = top.oversized;
        for (j = 0, len = ref.length; j < len; j++) {
          elt = ref[j];
          if (elt !== item && collisionFunction(item, elt)) {
            items.push(elt);
          }
        }
        ref1 = top.contents;
        for (k = 0, len1 = ref1.length; k < len1; k++) {
          elt = ref1[k];
          if (elt !== item && collisionFunction(item, elt)) {
            items.push(elt);
          }
        }
        fits = fitting(item, top);
        if (fits.length === 0) {
          fits = [];
          if (item.x >= top.x + top.width) {
            fits.push('NE');
          }
          if (item.y >= top.y + top.height) {
            fits.push('SW');
          }
          if (fits.length > 0) {
            if (fits.length === 1) {
              fits.push('SE');
            } else {
              fits = ['SE'];
            }
          }
        }
        for (l = 0, len2 = fits.length; l < len2; l++) {
          child = fits[l];
          if (top.children[child].tree != null) {
            fifo.push(top.children[child].tree);
          }
        }
      }
      return items;
    };

    Quadtree.prototype.onCollision = function(item, callback, collisionFunction) {
      var child, elt, fifo, fits, j, k, l, len, len1, len2, ref, ref1, top;
      if (collisionFunction == null) {
        collisionFunction = boundingBoxCollision;
      }
      validateElement(item);
      fifo = [this];
      while (fifo.length > 0) {
        top = fifo.shift();
        ref = top.oversized;
        for (j = 0, len = ref.length; j < len; j++) {
          elt = ref[j];
          if (elt !== item && collisionFunction(item, elt)) {
            callback(elt);
          }
        }
        ref1 = top.contents;
        for (k = 0, len1 = ref1.length; k < len1; k++) {
          elt = ref1[k];
          if (elt !== item && collisionFunction(item, elt)) {
            callback(elt);
          }
        }
        fits = fitting(item, top);
        if (fits.length === 0) {
          fits = [];
          if (item.x >= top.x + top.width) {
            fits.push('NE');
          }
          if (item.y >= top.y + top.height) {
            fits.push('SW');
          }
          if (fits.length > 0) {
            if (fits.length === 1) {
              fits.push('SE');
            } else {
              fits = ['SE'];
            }
          }
        }
        for (l = 0, len2 = fits.length; l < len2; l++) {
          child = fits[l];
          if (top.children[child].tree != null) {
            fifo.push(top.children[child].tree);
          }
        }
      }
      return null;
    };

    Quadtree.prototype.get = function(query) {
      return this.where(query);
    };

    Quadtree.prototype.where = function(query) {
      var check, elt, fifo, items, j, k, key, len, len1, ref, ref1, relatedChild, top;
      if (typeof query === 'object' && ((query.x == null) || (query.y == null))) {
        return this.find(function(elt) {
          var check, key;
          check = true;
          for (key in query) {
            if (query[key] !== elt[key]) {
              check = false;
            }
          }
          return check;
        });
      }
      validateElement(query);
      items = [];
      fifo = [this];
      while (fifo.length > 0) {
        top = fifo.shift();
        ref = top.oversized;
        for (j = 0, len = ref.length; j < len; j++) {
          elt = ref[j];
          check = true;
          for (key in query) {
            if (query[key] !== elt[key]) {
              check = false;
            }
          }
          if (check) {
            items.push(elt);
          }
        }
        ref1 = top.contents;
        for (k = 0, len1 = ref1.length; k < len1; k++) {
          elt = ref1[k];
          check = true;
          for (key in query) {
            if (query[key] !== elt[key]) {
              check = false;
            }
          }
          if (check) {
            items.push(elt);
          }
        }
        relatedChild = top.children[calculateDirection(query, top)];
        if (relatedChild.tree != null) {
          fifo.push(relatedChild.tree);
        }
      }
      return items;
    };

    Quadtree.prototype.each = function(action) {
      var child, fifo, i, j, k, len, len1, ref, ref1, top;
      fifo = [this];
      while (fifo.length > 0) {
        top = fifo.shift();
        ref = top.oversized;
        for (j = 0, len = ref.length; j < len; j++) {
          i = ref[j];
          if (typeof action === "function") {
            action(i);
          }
        }
        ref1 = top.contents;
        for (k = 0, len1 = ref1.length; k < len1; k++) {
          i = ref1[k];
          if (typeof action === "function") {
            action(i);
          }
        }
        for (child in top.children) {
          if (top.children[child].tree != null) {
            fifo.push(top.children[child].tree);
          }
        }
      }
      return this;
    };

    Quadtree.prototype.find = function(predicate) {
      var child, fifo, i, items, j, k, len, len1, ref, ref1, top;
      fifo = [this];
      items = [];
      while (fifo.length > 0) {
        top = fifo.shift();
        ref = top.oversized;
        for (j = 0, len = ref.length; j < len; j++) {
          i = ref[j];
          if (typeof predicate === "function" ? predicate(i) : void 0) {
            items.push(i);
          }
        }
        ref1 = top.contents;
        for (k = 0, len1 = ref1.length; k < len1; k++) {
          i = ref1[k];
          if (typeof predicate === "function" ? predicate(i) : void 0) {
            items.push(i);
          }
        }
        for (child in top.children) {
          if (top.children[child].tree != null) {
            fifo.push(top.children[child].tree);
          }
        }
      }
      return items;
    };

    Quadtree.prototype.filter = function(predicate) {
      var deepclone;
      deepclone = function(target) {
        var child, copycat, item, j, k, len, len1, ref, ref1, ref2, ref3;
        copycat = new Quadtree({
          x: target.x,
          y: target.y,
          width: target.width,
          height: target.height,
          maxElements: target.maxElements
        });
        copycat.size = 0;
        for (child in target.children) {
          if (!(target.children[child].tree != null)) {
            continue;
          }
          copycat.children[child].tree = deepclone(target.children[child].tree);
          copycat.size += (ref = (ref1 = copycat.children[child].tree) != null ? ref1.size : void 0) != null ? ref : 0;
        }
        ref2 = target.oversized;
        for (j = 0, len = ref2.length; j < len; j++) {
          item = ref2[j];
          if ((predicate == null) || (typeof predicate === "function" ? predicate(item) : void 0)) {
            copycat.oversized.push(item);
          }
        }
        ref3 = target.contents;
        for (k = 0, len1 = ref3.length; k < len1; k++) {
          item = ref3[k];
          if ((predicate == null) || (typeof predicate === "function" ? predicate(item) : void 0)) {
            copycat.contents.push(item);
          }
        }
        copycat.size += copycat.oversized.length + copycat.contents.length;
        if (copycat.size === 0) {
          return null;
        } else {
          return copycat;
        }
      };
      return deepclone(this);
    };

    Quadtree.prototype.reject = function(predicate) {
      return this.filter(function(i) {
        return !(typeof predicate === "function" ? predicate(i) : void 0);
      });
    };

    Quadtree.prototype.visit = function(action) {
      var child, fifo, that;
      fifo = [this];
      while (fifo.length > 0) {
        that = fifo.shift();
        action.bind(that)();
        for (child in that.children) {
          if (that.children[child].tree != null) {
            fifo.push(that.children[child].tree);
          }
        }
      }
      return this;
    };

    Quadtree.prototype.pretty = function() {
      var child, fifo, indent, indentation, isParent, str, top;
      str = '';
      indent = function(level) {
        var j, ref, res, times;
        res = '';
        for (times = j = ref = level; ref <= 0 ? j < 0 : j > 0; times = ref <= 0 ? ++j : --j) {
          res += '   ';
        }
        return res;
      };
      fifo = [
        {
          label: 'ROOT',
          tree: this,
          level: 0
        }
      ];
      while (fifo.length > 0) {
        top = fifo.shift();
        indentation = indent(top.level);
        str += indentation + "| " + top.label + "\n" + indentation + "| ------------\n";
        if (top.tree.oversized.length > 0) {
          str += indentation + "| * Oversized elements *\n" + indentation + "|   " + top.tree.oversized + "\n";
        }
        if (top.tree.contents.length > 0) {
          str += indentation + "| * Leaf content *\n" + indentation + "|   " + top.tree.contents + "\n";
        }
        isParent = false;
        for (child in top.tree.children) {
          if (!(top.tree.children[child].tree != null)) {
            continue;
          }
          isParent = true;
          fifo.unshift({
            label: child,
            tree: top.tree.children[child].tree,
            level: top.level + 1
          });
        }
        if (isParent) {
          str += indentation + "└──┐\n";
        }
      }
      return str;
    };

    return Quadtree;

  })();
}));



},{}],17:[function(require,module,exports){
module.exports={
  "NORTH EAST AMERICA" : "",
  "NORTH EAST AMERICA 1" : { "SERVER" : "NORTH EAST AMERICA", "IP" : "52.91.88.102" },
  "NORTH EAST AMERICA 2" : { "SERVER" : "NORTH EAST AMERICA", "IP" : "52.90.99.174" },
  "EUROPE" : "",
  "EUROPE 1" : { "SERVER" : "EUROPE", "IP" : "18.196.2.82" },
  "TEST" : "",
  "TEST 1" : { "SERVER" : "TEST", "IP" : "localhost" }
}

},{}],18:[function(require,module,exports){
var gameConfig = require('./gameConfig.json');
var radianFactor = Math.PI/180;
var objectAssign = require('../../modules/public/objectAssign.js');
// var msgpack = require('msgpack-js');
var msgpack = require('msgpack-lite');

//must use with bind or call method
exports.rotate = function(deltaTime){
  if(exports.isNumeric(this.rotateSpeed)){
    if(this.targetDirection === this.direction){
      if(this.currentState === gameConfig.OBJECT_STATE_MOVE || this.currentState === gameConfig.OBJECT_STATE_MOVE_AND_ATTACK){
        this.move(deltaTime);
      }else if(this.currentState === gameConfig.OBJECT_STATE_ATTACK){
      }else if(this.currentState === gameConfig.OBJECT_STATE_CAST){
        this.executeSkill();
      }
    }
    //check rotate direction
    else{
      if(this.direction > 0 && this.targetDirection < 0){
        if((180 - this.direction + 180 + this.targetDirection) < (this.direction - this.targetDirection)){
          if(Math.abs(this.targetDirection - this.direction) < this.rotateSpeed * deltaTime){
            this.direction += Math.abs(this.targetDirection - this.direction);
          }else{
            this.direction += this.rotateSpeed * deltaTime;
          }
        }else if(this.targetDirection < this.direction){
          if(Math.abs(this.targetDirection - this.direction)<this.rotateSpeed * deltaTime){
            this.direction -= Math.abs(this.targetDirection - this.direction);
          }else{
            this.direction -= this.rotateSpeed * deltaTime;
          }
        }
      }else if(this.direction < 0 && this.targetDirection >0 ){
        if((180 + this.direction + 180 - this.targetDirection) < (this.targetDirection - this.direction)){
          if(Math.abs(this.targetDirection - this.direction)<this.rotateSpeed * deltaTime){
            this.direction -= Math.abs(this.targetDirection - this.direction);
          }else{
            this.direction -= this.rotateSpeed * deltaTime;
          }
        }else if(this.targetDirection > this.direction){
          if(Math.abs(this.targetDirection - this.direction)<this.rotateSpeed * deltaTime){
            this.direction += Math.abs(this.targetDirection - this.direction);
          }else{
            this.direction += this.rotateSpeed * deltaTime;
          }
        }
      }else if(this.targetDirection > this.direction){
        if(Math.abs(this.targetDirection - this.direction)<this.rotateSpeed * deltaTime){
          this.direction += Math.abs(this.targetDirection - this.direction);
        }else{
          this.direction += this.rotateSpeed * deltaTime;
        }
      }else if(this.targetDirection < this.direction){
        if(Math.abs(this.targetDirection - this.direction)<this.rotateSpeed * deltaTime){
          this.direction -= Math.abs(this.targetDirection - this.direction);
        }else{
          this.direction -= this.rotateSpeed * deltaTime;
        }
      }
      if(this.currentState === gameConfig.OBJECT_STATE_MOVE || this.currentState === gameConfig.OBJECT_STATE_MOVE_AND_ATTACK){
        this.move(deltaTime, true);
      }
    }

    if(this.direction >= 180){
      this.direction -= 360;
    }else if(this.direction <= -180){
      this.direction += 360;
    }
  }
};

//must use with bind or call method
exports.move = function(deltaTime, isMoveSlight){
  //calculate dist with target
  if(exports.isNumeric(this.speed.x) && exports.isNumeric(this.speed.y)){
    var distX = this.targetPosition.x - this.center.x;
    var distY = this.targetPosition.y - this.center.y;

    var distSquare = Math.pow(distX, 2) + Math.pow(distY, 2);
    if(distSquare < 100 && this.currentState === gameConfig.OBJECT_STATE_MOVE_AND_ATTACK){
      this.executeSkill();
    }else if(distSquare < 100){
      this.stop();
      this.changeState(gameConfig.OBJECT_STATE_IDLE);
    }
    if(Math.abs(distX) < Math.abs(this.speed.x) * deltaTime){
      this.speed.x = distX / deltaTime;
    }
    if(Math.abs(distY) < Math.abs(this.speed.y) * deltaTime){
      this.speed.y = distY / deltaTime;
    }
    var addPos = this.onMove();
    if(addPos){
      if(exports.isNumeric(addPos.x) && exports.isNumeric(addPos.y)){
        this.position.x += addPos.x;
        this.position.y += addPos.y;
      }
    }
    if(isMoveSlight){
      this.position.x += this.speed.x * deltaTime * gameConfig.MOVE_SLIGHT_RATE;
      this.position.y += this.speed.y * deltaTime * gameConfig.MOVE_SLIGHT_RATE;
    }else{
      this.position.x += this.speed.x * deltaTime;
      this.position.y += this.speed.y * deltaTime;
    }

    if(this.position.x < 0){
      this.position.x = 0;
    }else if(this.position.x > gameConfig.CANVAS_MAX_SIZE.width - this.size.width){
      this.position.x = gameConfig.CANVAS_MAX_SIZE.width - this.size.width;
    }
    if(this.position.y < 0){
      this.position.y = 0;
    }else if(this.position.y > gameConfig.CANVAS_MAX_SIZE.height - this.size.height){
      this.position.y = gameConfig.CANVAS_MAX_SIZE.height - this.size.height;
    }

    this.setCenter();
    if(addPos){
      if(this.isMoveBackward){
        this.setTargetDirection(true);
        this.setSpeed(gameConfig.MOVE_BACK_WARD_SPEED_DECREASE_RATE);
      }else{
        this.setTargetDirection();
        this.setSpeed();
      }
    }
  }
};

//must use with bind or call method
//setup when click canvas for move
exports.setSpeed = function(decreaseRate){
  var distX = this.targetPosition.x - this.center.x;
  var distY = this.targetPosition.y - this.center.y;

  var distXSquare = Math.pow(distX,2);
  var distYSquare = Math.pow(distY,2);

  if(distX == 0  && distY ==0){
    this.speed.x = 0;
    this.speed.y = 0;
  }else if(distXSquare + distYSquare < 100){
    this.speed.x = distX;
    this.speed.y = distY;
  }else{
    this.speed.x = (distX>=0?1:-1)* this.maxSpeed * Math.sqrt(distXSquare / (distXSquare + distYSquare));
    this.speed.y = (distY>=0?1:-1)* this.maxSpeed * Math.sqrt(distYSquare / (distXSquare + distYSquare));
  }

  if(decreaseRate){
    this.speed.x *= (1 - decreaseRate);
    this.speed.y *= (1 - decreaseRate);
  }
};

//must use with bind or call method
// setup when click canvas for move or fire skill
exports.setTargetDirection = function(moveBackward){
  var distX = this.targetPosition.x - this.center.x;
  var distY = this.targetPosition.y - this.center.y;

  var tangentDegree = Math.atan(distY/distX) * 180 / Math.PI;
  if(isNaN(tangentDegree)){
    this.targetDirection = this.direction;
  }else{
    if(distX < 0 && distY >= 0){
      this.targetDirection = tangentDegree + 180;
    }else if(distX < 0 && distY < 0){
      this.targetDirection = tangentDegree - 180;
    }else{
      this.targetDirection = tangentDegree;
    }
  }

  if(moveBackward){
    if(this.targetDirection >= 0){
      this.targetDirection -= 180;
    }else{
      this.targetDirection += 180;
    }
  }
};
exports.setTargetPosition = function(clickPosition, user){
  var targetX = clickPosition.x;
  var targetY = clickPosition.y;
  if(targetX < user.size.width/2){
    targetX = user.size.width/2
  }else if(targetX > gameConfig.CANVAS_MAX_SIZE.width - user.size.width/2){
    targetX = gameConfig.CANVAS_MAX_SIZE.width - user.size.width/2;
  }

  if(targetY < user.size.height/2){
    targetY = user.size.height/2
  }else if(targetY > gameConfig.CANVAS_MAX_SIZE.height - user.size.height/2){
    targetY = gameConfig.CANVAS_MAX_SIZE.height - user.size.height/2;
  }

  return {
    x : Math.floor(targetX),
    y : Math.floor(targetY)
  };
};
exports.setMoveAttackUserTargetPosition = function(clickPosition, baseSkillData, user){
  var vecX = clickPosition.x - user.center.x;
  var vecY = clickPosition.y - user.center.y;
  var unitVecX = vecX / Math.sqrt(Math.pow(vecX, 2) + Math.pow(vecY, 2));
  var unitVecY = vecY / Math.sqrt(Math.pow(vecX, 2) + Math.pow(vecY, 2));

  var scale = baseSkillData.range;

  var distVecX = vecX - unitVecX * scale;
  var distVecY = vecY - unitVecY * scale;

  if(Math.sqrt(Math.pow(vecX, 2) + Math.pow(vecY, 2)) < scale){
    var moveBackward = true;
  }else{
    moveBackward = false;
  }
  return {
    x : user.center.x + distVecX,
    y : user.center.y + distVecY,
    moveBackward : moveBackward
  };
};
//check obstacle collision
exports.checkCircleCollision = function(tree, posX, posY, radius, id){
  var returnVal = [];
  var obj = {x : posX, y: posY, width: radius * 2, height: radius * 2, id: id};
  tree.onCollision(obj, function(item){
    if(obj.id !== item.id){
      var objCenterX = obj.x + radius;
      var objCenterY = obj.y + radius;

      var itemCenterX = item.x + item.width/2;
      var itemCenterY = item.y + item.height/2;

      // check sum of radius with item`s distance
      var distSquareDiff = Math.pow(radius + item.width/2,2) - Math.pow(itemCenterX - objCenterX,2) - Math.pow(itemCenterY - objCenterY,2);

      if(distSquareDiff > 0 ){
        returnVal.collisionPosition = {x : (objCenterX + itemCenterX) / 2,
                                       y : (objCenterY + itemCenterY) / 2};
        //collision occured
        returnVal.push(item);
      }
    }
  });
  return returnVal;
};
exports.calcCompelPos = function(obj, collisionObjs){
  var addPos = { x : 0 , y : 0 };
  for(var i=0; i<collisionObjs.length; i++){
    var objCenterX = obj.x + obj.width/2;
    var objCenterY = obj.y + obj.height/2;

    var itemCenterX = collisionObjs[i].x + collisionObjs[i].width/2;
    var itemCenterY = collisionObjs[i].y + collisionObjs[i].height/2;

    var vecX = objCenterX - itemCenterX;
    var vecY = objCenterY - itemCenterY;

    var dist = obj.width/2 + collisionObjs[i].width/2 - Math.sqrt(Math.pow(vecX,2) + Math.pow(vecY,2));
    var ratioXYSquare = Math.pow(vecY/vecX,2);

    var distFactorX = dist * Math.sqrt(1/(1+ratioXYSquare));
    var distFactorY = dist * Math.sqrt((ratioXYSquare) / (1 + ratioXYSquare));

    // 1.3 is make more gap between obj and collisionObjs
    addPos.x += (vecX > 0 ? 1 : -1) * distFactorX * 1.1;
    addPos.y += (vecY > 0 ? 1 : -1) * distFactorY * 1.1;
  }
  return addPos;
};

exports.checkAndCalcCompelPos = function(tree, posX, posY, radius, id, obj){
  var collisionObjs = [];
  var obj = {x : posX, y: posY, width:radius * 2, height: radius * 2, id: id};
  tree.onCollision(obj, function(item){
    if(obj.id !== item.id){
      var objCenterX = obj.x + obj.width/2;
      var objCenterY = obj.y + obj.height/2;

      var itemCenterX = item.x + item.width/2;
      var itemCenterY = item.y + item.height/2;

      // check sum of radius with item`s distance
      var distSquareDiff = Math.pow(obj.width/2 + item.width/2,2) - Math.pow(itemCenterX - objCenterX,2) - Math.pow(itemCenterY - objCenterY,2);

      if(distSquareDiff > 0 ){
        //collision occured
        collisionObjs.push(item);
      }
    }
  });
  var addPos = { x : 0 , y : 0 };
  for(var i in collisionObjs){
    var objCenterX = obj.x + obj.width/2;
    var objCenterY = obj.y + obj.height/2;

    var itemCenterX = collisionObjs[i].x + collisionObjs[i].width/2;
    var itemCenterY = collisionObjs[i].y + collisionObjs[i].height/2;

    var vecX = objCenterX - itemCenterX;
    var vecY = objCenterY - itemCenterY;

    var dist = obj.width/2 + collisionObjs[i].width/2 - Math.sqrt(Math.pow(vecX,2) + Math.pow(vecY,2));
    var ratioXYSquare = Math.pow(vecY/vecX,2);

    var distFactorX = dist * Math.sqrt(1/(1+ratioXYSquare));
    var distFactorY = dist * Math.sqrt((ratioXYSquare) / (1 + ratioXYSquare));

    // 1.3 is make more gap between obj and collisionObjs
    addPos.x += (vecX > 0 ? 1 : -1) * distFactorX * 1;
    addPos.y += (vecY > 0 ? 1 : -1) * distFactorY * 1;
  }
  return addPos;
};

//coordinate transform
exports.localToWorldPosition = function(position, offset){
  return {
    x : position.x + offset.x,
    y : position.y + offset.y
  };
};
exports.worldToLocalPosition = function(position, offset, scaleFactor){
  if(scaleFactor){
    return {
      x : (position.x - offset.x) * scaleFactor,
      y : (position.y - offset.y) * scaleFactor
    };
  }else{
    return {
      x : position.x - offset.x,
      y : position.y - offset.y
    };
  }
};
exports.worldXCoordToLocalX = function(x, offsetX, scaleFactor){
  return (x - offsetX) * scaleFactor;
};
exports.worldYCoordToLocalY = function(y, offsetY, scaleFactor){
  return (y - offsetY) * scaleFactor;
};
// exports.calculateOffset = function(obj, canvasSize){
//   var newOffset = {
//     x : obj.position.x + obj.size.width/2 - canvasSize.width/2,
//     y : obj.position.y + obj.size.height/2 - canvasSize.height/2
//   };
//   return newOffset;
// };
exports.isXInCanvas = function(x, gameConfig){
  if(x>0 && x<gameConfig.canvasSize.width){
    return true;
  }
  return false;
};
exports.isYInCanvas = function(y, gameConfig){
  if(y>0 && y<gameConfig.canvasSize.height){
    return true;
  }
  return false;
};
exports.isObjInCanvas = function(center, radius, gameConfig){
  if(center.x - (radius + 100) <= gameConfig.canvasSize.width && center.x + (radius + 100) >= 0
     && center.y - (radius + 100) <= gameConfig.canvasSize.height && center.y + (radius + 100) >= 0){
   return true;
 }
 return false;
};

//calcurate distance
exports.distanceSquare = function(position1, position2){
  var distX = position1.x - position2.x;
  var distY = position1.y - position2.y;

  var distSquare = Math.pow(distX, 2) + Math.pow(distY, 2);
  return distSquare;
};
exports.distance = function(position1, position2){
  var distSquare = exports.distanceSpuare(position1, position2);
  return Math.sqrt(distSquare);
};
//calcurate targetDirection;
exports.calcSkillTargetPosition = function(skillData, clickPosition, user){
  switch (skillData.type) {
    case gameConfig.SKILL_TYPE_INSTANT_RANGE:
      var addPosX = skillData.range * Math.cos(user.direction * radianFactor);
      var addPosY = skillData.range * Math.sin(user.direction * radianFactor);

      return {
        x : user.center.x + addPosX,
        y : user.center.y + addPosY
      };
    case gameConfig.SKILL_TYPE_INSTANT_PROJECTILE:
      return {
        x : clickPosition.x,
        y : clickPosition.y
      };
    case gameConfig.SKILL_TYPE_RANGE:
      var distSquare = exports.distanceSquare(user.center, clickPosition);
      if(Math.pow(skillData.range,2) > distSquare){
        return {
          x : clickPosition.x,
          y : clickPosition.y
        };
      }else{
        var distX = clickPosition.x - user.center.x;
        var distY = clickPosition.y - user.center.y;
        var radian = Math.atan(distY / distX);
        if(isNaN(radian)){
          radian = user.direction;
        }else if(distX < 0 && distY >= 0){
          radian += Math.PI;
        }else if(distX < 0 && distY < 0){
          radian -= Math.PI;
        }

        var addPosX = skillData.range * Math.cos(radian);
        var addPosY = skillData.range * Math.sin(radian);

        return {
          x : user.center.x + addPosX,
          y : user.center.y + addPosY
        };
      }
    case gameConfig.SKILL_TYPE_SELF :
      return {
        x : user.center.x,
        y : user.center.y
      };
    case gameConfig.SKILL_TYPE_SELF_EXPLOSION :
      return {
        x : user.center.x,
        y : user.center.y
      };
    case gameConfig.SKILL_TYPE_TELEPORT :
      var distSquare = exports.distanceSquare(user.center, clickPosition);
      if(Math.pow(skillData.range,2) > distSquare){
        return {
          x : clickPosition.x,
          y : clickPosition.y
        };
      }else{
        var distX = clickPosition.x - user.center.x;
        var distY = clickPosition.y - user.center.y;
        var radian = Math.atan(distY / distX);
        if(isNaN(radian)){
          radian = user.direction;
        }else if(distX < 0 && distY >= 0){
          radian += Math.PI;
        }else if(distX < 0 && distY < 0){
          radian -= Math.PI;
        }

        var addPosX = skillData.range * Math.cos(radian);
        var addPosY = skillData.range * Math.sin(radian);

        return {
          x : user.center.x + addPosX,
          y : user.center.y + addPosY
        };
      }
    case gameConfig.SKILL_TYPE_PROJECTILE :
      return {
        x : clickPosition.x,
        y : clickPosition.y
      };
    case gameConfig.SKILL_TYPE_PROJECTILE_TICK :
      return {
        x : clickPosition.x,
        y : clickPosition.y
      };
    case gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION :
      return {
        x : clickPosition.x,
        y : clickPosition.y
      };
    case gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION :
      return{
        x : clickPosition.x,
        y : clickPosition.y
      };
    default:
  }
};
exports.calcSkillTargetDirection = function(skillType, targetPosition, user){
  switch (skillType) {
    case gameConfig.SKILL_TYPE_INSTANT_RANGE:
      return user.direction;
    case gameConfig.SKILL_TYPE_INSTANT_PROJECTILE:
      return user.direction;
    case gameConfig.SKILL_TYPE_RANGE:
      return exports.calcTargetDirection(targetPosition, user.center, user.direction);
    case gameConfig.SKILL_TYPE_SELF :
      return user.direction;
    case gameConfig.SKILL_TYPE_SELF_EXPLOSION :
      return user.direction;
    case gameConfig.SKILL_TYPE_TELEPORT :
      return exports.calcTargetDirection(targetPosition, user.center, user.direction);
    case gameConfig.SKILL_TYPE_PROJECTILE :
      return exports.calcTargetDirection(targetPosition, user.center, user.direction);
    case gameConfig.SKILL_TYPE_PROJECTILE_TICK :
      return exports.calcTargetDirection(targetPosition, user.center, user.direction);
    case gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION :
      return exports.calcTargetDirection(targetPosition, user.center, user.direction);
    case gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION :
      return exports.calcTargetDirection(targetPosition, user.center, user.direction);
    default:
  }
};
exports.calcTargetDirection = function(targetPosition, centerPosition, userDirection){
  var distX = targetPosition.x - centerPosition.x;
  var distY = targetPosition.y - centerPosition.y;

  var tangentDegree = Math.atan(distY/distX) * 180 / Math.PI;

  var returnVal = 0;
  if(isNaN(tangentDegree)){
    return userDirection;
  }else{
    if(distX < 0 && distY >= 0){
      returnVal = tangentDegree + 180;
    }else if(distX < 0 && distY < 0){
      returnVal = tangentDegree - 180;
    }else{
      returnVal = tangentDegree;
    }
  }
  return returnVal;
};
exports.calcTargetPosition = function(centerPosition, direction, range){
  var addPosX = range * Math.cos(direction * radianFactor);
  var addPosY = range * Math.sin(direction * radianFactor);

  return {x : addPosX, y : addPosY};
};
//find last coincident data
exports.findData = function(table, columnName, value){
  try {
    if (table) {
      var data = undefined;
      for(var i=0; i<table.length; i++){
        if(table[i][columnName] == value){
          data = table[i];
          break;
        }
      }
      return data;
    }
  } catch (e) {
    console.log(e);
  }
  // for(var index in table){
  //   //use ==, because value can be integer
  //   if(table[index][columnName] == value){
  //     data = table[index];
  //     break;
  //   }
  // }
};
exports.findAllDatas = function(table, columnName, value){
  try {
    if (table) {
      var datas = [];
      for(var i=0; i<table.length; i++){
        if(table[i][columnName] == value){
          datas.push(table[i]);
        }
      }
      // for(var index in table){
        //   if(table[index][columnName] == value){
          //     datas.push(table[index]);
          //   }
          // }
      return datas;
    }
  } catch (e) {
    console.log(e);
  }
}
exports.findDataWithTwoColumns = function(table, columnName1, value1, columnName2, value2){
  var datas = [];
  var data = null;
  for(var i=0; i<table.length; i++){
    if(table[i][columnName1] == value1){
      datas.push(table[i]);
    }
  }
  if(datas.length > 0){
    for(var i=0; i<datas.length; i++){
      if(datas[i][columnName2] == value2){
        data = datas[i];
        break;
      }
    }
  }
  return data;
  // for(var index in table){
  //   if(table[index][columnName1] == value1){
  //     datas.push(table[index]);
  //   }
  // }
  // if(datas.length > 0){
  //   for(var index in datas){
  //     if(datas[index][columnName2] == value2){
  //       data = datas[index];
  //       break;
  //     }
  //   }
  // }else{
  //   return null;
  // }
  // return data;
}
exports.findAndSetBuffs = function(buffGroupData, buffTable, actorID){
  var returnVal = [];
  for(var i=0; i<10; i++){
    var buffIndex = buffGroupData['buff' + (i + 1)];
    if(buffIndex){
      var buffData = objectAssign({}, exports.findData(buffTable, 'index', buffIndex));
      buffData.actorID = actorID;
      returnVal.push(buffData);
    }else{
      return returnVal;
    }
  }
  return returnVal;
};
exports.getBuffs = function(buffGroupData){
  var returnVal = [];
  for(var i=0; i<10; i++){
    if(buffGroupData['buff' + (i + 1)]){
      returnVal.push(buffGroupData['buff' + (i + 1)]);
    }
  }
  return returnVal;
};
exports.getMobs = function(mobGenData, mobTable){
  var returnVal = [];
  for(var i=0; i<5; i++){
    if(mobGenData['genMob' + (i + 1)]){
      var mobData = exports.findData(mobTable, 'index', mobGenData['genMob' + (i + 1)]);
      returnVal.push(mobData);
    }
  }
  return returnVal;
};
exports.setResourceData = function(resourceTable, buffImgData){
  var resourceDataList = [];
  buffImgData.resourceLength = 0;
  for(var i=0; i<10; i++){
    var resourceIndex = buffImgData['resourceIndex' + (i + 1)];
    if(resourceIndex){
      var resourceData = objectAssign({}, exports.findData(resourceTable, 'index', resourceIndex));
      buffImgData['resourceIndex' + (i + 1)] = resourceData;
      buffImgData.resourceLength = i + 1;
    }else{
      break;
    }
  }
  if(buffImgData.resourceLength){
    return true;
  }else{
    return false;
  }
};
exports.makeUserEffect = function(user, effectData){
  //set effect center
  var effectCenter = { x : user.center.x, y : user.center.y };
  //set effect index
  var effectIndex = 0;
  //set effect
  var effect = {
    index : effectData.index,
    isRotate : effectData.isRotate,
    resourceIndex1 : effectData.resourceIndex1,
    resourceIndex2 : effectData.resourceIndex2,
    resourceIndex3 : effectData.resourceIndex3,
    resourceIndex4 : effectData.resourceIndex4,
    resourceIndex5 : effectData.resourceIndex5,
    resourceIndex6 : effectData.resourceIndex6,
    resourceIndex7 : effectData.resourceIndex7,
    resourceIndex8 : effectData.resourceIndex8,
    resourceIndex9 : effectData.resourceIndex9,
    resourceIndex10 : effectData.resourceIndex10,
    resourceLength : effectData.resourceLength,

    resourceLifeTime : effectData.resourceLifeTime,
    startTime : Date.now(),
    effectTimer : Date.now(),

    effectIndex : effectIndex,
    center : effectCenter,

    changeIndex : function(){
      if(this.effectIndex + 1 >= this.resourceLength){
        this.effectIndex = 0;
      }else{
        this.effectIndex++;
      }
      this.effectTimer = Date.now();
    }
  }
  return effect;
};
exports.generateRandomUniqueID = function(uniqueCheckArray, prefix, idCount){
  if(!idCount){
    var IDisUnique = false;
    while(!IDisUnique){
      var randomID = generateRandomID(prefix);
      IDisUnique = true;
      for(var index in uniqueCheckArray){
        if(randomID == uniqueCheckArray[index].objectID){
          IDisUnique = false;
        }
      }
    }
    return randomID;
  }else if(idCount){
    var IDs = [];
    for(var i=0; i<idCount; i++){
      var IDisUnique = false;
      while(!IDisUnique){
        var randomID = generateRandomID(prefix);
        IDisUnique = true;
        for(var index in uniqueCheckArray){
          if(randomID == uniqueCheckArray[index].objectID){
            IDisUnique = false;
          }
        }
        for(var j=0; j<IDs.length; j++){
          if(randomID == IDs[j]){
            IDisUnique = false;
          }
        }
        if(IDisUnique){
          IDs.push(randomID);
        }
      }
    }
    return IDs;
  }
};
exports.getElementsByClassName = function(parentDiv, className){
  var returnDivs = [];
  var childrenDivs = parentDiv.getElementsByTagName('div');
  for(var i=0; i<childrenDivs.length; i++){
    for(var j=0; j<childrenDivs[i].classList.length; j++){
      if(childrenDivs[i].classList[j] === className){
        returnDivs.push(childrenDivs[i]);
      }
    }
  }
  return returnDivs;
};
exports.calcForePosition = function(center, radius, direction, distance){
  return {
    x : center.x + distance * Math.cos(direction * radianFactor) - radius,
    y : center.y + distance * Math.sin(direction * radianFactor) - radius
  };
};
exports.interpolationSine = function(time, lifeTime){
  if(lifeTime){
    return gameConfig.SKILL_EFFECT_INTERPOLATION_FACTOR * Math.sin(Math.PI * time / lifeTime) + 0.5;
  }else{
    return gameConfig.CAST_EFFECT_INTERPOLATION_FACTOR * Math.sin(2 * Math.PI * time / 1000) + 1;
  }
};
exports.isNumeric = function(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}
function generateRandomID(prefix){
  var output = prefix;
  for(var i=0; i<6; i++){
    output += Math.floor(Math.random()*16).toString(16);
  }
  return output;
};
exports.makeCssClipStyle = function(iconData, expandRate){
  if(expandRate){
    return "rect(" + (iconData.top * expandRate) + "px," + (iconData.right * expandRate) + "px," + (iconData.bottom * expandRate) + "px," + (iconData.left * expandRate) + "px)";
  }else{
    return "rect(" + iconData.top + "px," + iconData.right + "px," + iconData.bottom + "px," + iconData.left + "px)";
  }
};
exports.setImgCssStyle = function(imgDiv, iconData, expandRate){
  if(expandRate){
    imgDiv.style.position = "absolute";
    imgDiv.style.top = (-iconData.top * expandRate) + "px";
    imgDiv.style.left = (-iconData.left * expandRate) + "px";
    imgDiv.style.width = (gameConfig.IMAGE_SOURCE_SIZE.width * expandRate) + "px";
    imgDiv.style.height = (gameConfig.IMAGE_SOURCE_SIZE.height * expandRate) + "px";
  }else{
    imgDiv.style.position = "absolute";
    imgDiv.style.top = (-iconData.top) + "px";
    imgDiv.style.left = (-iconData.left) + "px";
    imgDiv.style.width = (gameConfig.IMAGE_SOURCE_SIZE.width) + "px";
    imgDiv.style.height = (gameConfig.IMAGE_SOURCE_SIZE.height) + "px";
  }
};
exports.processMessage = function(msg, stringLength, isName){
  var newMsg = msg.replace(/(<([^>]+)>)/ig, '').substring(0,stringLength);
  if (isName) {
    return newMsg.replace(/\s/gi, "");
  } else {
    return newMsg;
  }
};
exports.createDomSelectOptGroup = function(label, parentNode){
  var optGroup = document.createElement("optgroup");
  optGroup.label = label;
  parentNode.appendChild(optGroup);
};
exports.createDomSelectOption = function(text, value, isDisabled, parentNode){
  var option = document.createElement("option");
  option.setAttribute("value", value);
  if(isDisabled){
    option.disabled = true;
  }
  var optionText = document.createTextNode(text);
  option.appendChild(optionText);
  parentNode.appendChild(option);
};
exports.createRequest = function(){
  var request;
  try {
    request = new XMLHttpRequest();
  } catch (e){
    try {
      request = new ActiveXObject('Msxml2.XMLHTTP');
    } catch (innerE) {
      request = new ActiveXObject('Microsoft.XMLHTTP');
    }
  }
  return request;
};
exports.getCookie = function(cookie, key){
  var cols = cookie.split(';');
  for(var i=0; i<cols.length; i++){
    var col = cols[i];
    while(col.charAt(0) == ' '){
      col = col.substring(1);
    }
    if(col.indexOf(key) === 0){
      var val = col.substring(key.length + 1, col.length);
      if(val === 'true'){
        return true;
      }else if(val === 'false'){
        return false;
      }else{
        return val;
      }
    }
  }
  return '';
};
exports.setCookie = function(key, value){
  var date = new Date();
  date.setTime(date.getTime() + (7 * 24 * 60 * 60 * 1000));
  var expires = "expires="+ date.toUTCString();
  document.cookie = key + "=" + value + ";" + expires + ";path=/";
};
// function setCookie(cname, cvalue, exdays) {
//     var d = new Date();
//     d.setTime(d.getTime() + (exdays*24*60*60*1000));
//     var expires = "expires="+ d.toUTCString();
//     document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
// }
exports.isRender = function(user, otherUser, targetPosition, x, y){
  var rangeX = x ? x : 900;
  var rangeY = y ? y : 600;
  if(Math.abs(otherUser.center.x - user.center.x) > rangeX && Math.abs(targetPosition.x - user.center.x) > rangeX){
    return false;
  }else if(Math.abs(otherUser.center.y - user.center.y) > rangeY && Math.abs(targetPosition.y - user.center.y) > rangeY){
    return false;
  }else{
    return true;
  }
};
exports.setDrawUser = function(users, user, gameConfig){
  var drawUsers = [];
  for(var index in users){
    var center = exports.worldToLocalPosition(users[index].center, gameConfig.userOffset, gameConfig.scaleFactor);
    if(exports.isObjInCanvas(center, users[index].size.width, gameConfig)){
      var position = exports.worldToLocalPosition(users[index].position, gameConfig.userOffset, gameConfig.scaleFactor);
      var skill = false;
      if(users[index].currentSkill){
        skill = users[index].currentSkill.property
      }
      drawUsers.push({
        objectID: users[index].objectID,
        level: users[index].level,
        name: users[index].name,
        textCanvas : users[index].textCanvas,
        textScaleFactor : users[index].textScaleFactor,
        HP: users[index].HP,
        maxHP: users[index].maxHP,
        MP: users[index].MP,
        maxMP: users[index].maxMP,
        chatMessage1: users[index].chatMessage1,
        chatMessage2: users[index].chatMessage2,
        // center: users[index].center,
        // position: users[index].position,
        localCenter: center,
        localPosition: position,
        direction: users[index].direction,
        buffImgDataList: users[index].buffImgDataList,
        effectIndex: users[index].effectIndex,
        effectRotateDegree: users[index].effectRotateDegree,
        imgHandIndex: users[index].imgHandIndex,
        imgData: users[index].imgData,
        skillCastEffectPlay: users[index].skillCastEffectPlay,
        // currentSkill: users[index].currentSkill,
        currentSkill: skill,
        castEffectFactor : users[index].castEffectFactor,
        hitImgDataList: users[index].hitImgDataList,
        buffImgDataList: users[index].buffImgDataList
      });
      // drawUsers.push(users[index]);
    }
  }
  return drawUsers;
};
exports.setDrawMobs = function(monsters, gameConfig){
  var drawMobs = [];
  // for(var i=0; i<monsters.length; i++){
  for(var i in monsters){
    var center = exports.worldToLocalPosition(monsters[i].center, gameConfig.userOffset, gameConfig.scaleFactor);
    if(exports.isObjInCanvas(center, monsters[i].size.width, gameConfig)){
      var position = exports.worldToLocalPosition(monsters[i].position, gameConfig.userOffset, gameConfig.scaleFactor);
      drawMobs.push({
        objectID: monsters[i].objectID,
        HP: monsters[i].HP,
        maxHP: monsters[i].maxHP,
        localCenter: center,
        localPosition: position,
        direction: monsters[i].direction + monsters[i].attackDegree,

        effectIndex: monsters[i].effectIndex,
        effectRotateDegree: monsters[i].effectRotateDegree,
        imgData: monsters[i].imgData,
        buffImgDataList: monsters[i].buffImgDataList,
        hitImgDataList: monsters[i].hitImgDataList
      });
    }
  }
  return drawMobs;
};
exports.checkName = function(charType, name) {
  if ((name.slice(0, 5) == "Pyro#" && charType !== gameConfig.CHAR_TYPE_FIRE) ||
      (name.slice(0, 8) == "Froster#" && charType !== gameConfig.CHAR_TYPE_FROST) ||
      (name.slice(0, 7) == "Myster#" && charType !== gameConfig.CHAR_TYPE_ARCANE)){
    return null;
  } else {
    return name;
  }
}
exports.setRandomName = function(charType){
  var suffix = "";
  for(var i=0; i<3; i++){
    suffix += Math.floor(Math.random() * 10);
  }
  switch (charType) {
    case gameConfig.CHAR_TYPE_FIRE:
      return "Pyro#" + suffix;
    case gameConfig.CHAR_TYPE_FROST:
      return "Froster#" + suffix;
    case gameConfig.CHAR_TYPE_ARCANE:
      return "Myster#" + suffix;
    default:
  }
};
// var keyCodeTable = require('./keyCodeTable');
exports.charToKeyCode = function(char){
  var keyCodeTable = require('./keyCodeTable');
  return keyCodeTable[char.toLowerCase()];
};
exports.keyCodeToChar = function(keyCode){
  var keyCodeTable = require('./keyCodeTable');
  for(var index in keyCodeTable){
    if(keyCodeTable[index] == keyCode){
      return index.toUpperCase();
    }
  }
};
exports.makeCacheCanvas = function(level, name, scaleFactor){
  var cacheCanvas = document.createElement('canvas');
  var ctx = cacheCanvas.getContext('2d');
  cacheCanvas.width = 400 * scaleFactor;
  cacheCanvas.height = 100 * scaleFactor;
  ctx.beginPath();
  ctx.textAlign = "center";
  ctx.fillStyle = "black";
  ctx.font = "bold 15px Arial";
  ctx.fillText("Lv." + level + " " + name, 200 * scaleFactor, 50 * scaleFactor, 200 * scaleFactor);
  ctx.closePath();
  return cacheCanvas;
};
exports.makePacketForm = function(type){
  var vars = [];
  for(var i=1; i<arguments.length; i++){
    vars.push(arguments[i]);
  }
  return msgpack.encode({
    t: type,
    v: vars
  });
};
exports.decodePacket = function(data){
    return msgpack.decode(data);
};


exports.processUserData = function(rawData) {
  return {
    oID: rawData[0],
    tp: rawData[1],
    nm: rawData[2],
    cs: rawData[3],
    pos: rawData[4],
    tpos: rawData[5],
    msp: rawData[6],
    dir: rawData[7],
    rsp: rawData[8],
    lv: rawData[9],
    ep: rawData[10],
    mHP: rawData[11],
    mMP: rawData[12],
    HP: rawData[13],
    MP: rawData[14],
    csp: rawData[15],
    cdt: rawData[16]
  };
};
exports.processUserAddData = function(rawData) {
  return {
    oID: rawData[0],
    tp: rawData[1],
    nm: rawData[2],
    cs: rawData[3],
    pos: rawData[4],
    tpos: rawData[5],
    msp: rawData[6],
    dir: rawData[7],
    rsp: rawData[8],
    lv: rawData[9],
    ep: rawData[10],
    mHP: rawData[11],
    mMP: rawData[12],
    HP: rawData[13],
    MP: rawData[14],
    csp: rawData[15],
    cdt: rawData[16],

    bS: rawData[17],
    pS: rawData[18],
    ipS: rawData[19],
    eS: rawData[20],
    aS: rawData[21],

    dR: rawData[22],
    fiDR: rawData[23],
    frDR: rawData[24],
    acDR: rawData[25],
    rA: rawData[26],
    rFi: rawData[27],
    rFr: rawData[28],
    rAc: rawData[29],
    sP: rawData[30],
    sM: rawData[31],
    sS: rawData[32],
    cRR: rawData[33],

    g: rawData[34],
    j: rawData[35]
  };
};
exports.processUserAddReData = function(rawData) {
  return {
    oID: rawData[0],
    tp: rawData[1],
    nm: rawData[2],
    cs: rawData[3],
    pos: rawData[4],
    tpos: rawData[5],
    msp: rawData[6],
    dir: rawData[7],
    rsp: rawData[8],
    lv: rawData[9],
    ep: rawData[10],
    mHP: rawData[11],
    mMP: rawData[12],
    HP: rawData[13],
    MP: rawData[14],
    csp: rawData[15],
    cdt: rawData[16],

    bS: rawData[17],
    pS: rawData[18],
    ipS: rawData[19],

    dR: rawData[20],
    fiDR: rawData[21],
    frDR: rawData[22],
    acDR: rawData[23],
    rA: rawData[24],
    rFi: rawData[25],
    rFr: rawData[26],
    rAc: rawData[27],
    sP: rawData[28],
    sM: rawData[29],
    sS: rawData[30],
    cRR: rawData[31]
  };
};
exports.processUserMAData = function(rawData) {
  return {
    oID: rawData[0],
    tp: rawData[1],
    nm: rawData[2],
    cs: rawData[3],
    pos: rawData[4],
    tpos: rawData[5],
    msp: rawData[6],
    dir: rawData[7],
    rsp: rawData[8],
    lv: rawData[9],
    ep: rawData[10],
    mHP: rawData[11],
    mMP: rawData[12],
    HP: rawData[13],
    MP: rawData[14],
    csp: rawData[15],
    cdt: rawData[16],

    sID: rawData[17],
    sTPos: rawData[18],
    mB: rawData[19]
  };
};
exports.processUserUSData = function(rawData) {
  return {
    oID: rawData[0],
    tp: rawData[1],
    nm: rawData[2],
    cs: rawData[3],
    pos: rawData[4],
    tpos: rawData[5],
    msp: rawData[6],
    dir: rawData[7],
    rsp: rawData[8],
    lv: rawData[9],
    ep: rawData[10],
    mHP: rawData[11],
    mMP: rawData[12],
    HP: rawData[13],
    MP: rawData[14],
    csp: rawData[15],
    cdt: rawData[16],

    sID: rawData[17],
    sDir: rawData[18],
    sTPos: rawData[19],

    sPIDs: rawData[20]
  };
};
exports.processUserStatData = function(rawData) {
  return {
      oID: rawData[0],
      tp : rawData[1],
      lv : rawData[2],
      ep : rawData[3],
      mHP: rawData[4],
      mMP: rawData[5],
      HP : rawData[6],
      MP : rawData[7],
      csp: rawData[8],
      msp: rawData[9],
      rsp: rawData[10],
      cdt: rawData[11]
  };
};
exports.processScoreDatas = function(rawDatas) {
  var datas = [];
  for (var i=0; i<rawDatas.length; i++) {
    datas.push({
      id : rawDatas[i][0],
      nm : rawDatas[i][1],
      lv: rawDatas[i][2],
      kS : rawDatas[i][3],
      tS : rawDatas[i][4],
      tK : rawDatas[i][5]
    });
  }
  return datas;
};
exports.processUserPrivateData = function(rawData) {
  return  {
    dR : rawData[0],
    fiDR : rawData[1],
    frDR : rawData[2],
    acDR : rawData[3],
    rA : rawData[4],
    rFi : rawData[5],
    rFr : rawData[6],
    rAc : rawData[7],
    lv : rawData[8],
    sP : rawData[9],
    sM : rawData[10],
    sS : rawData[11],
    cRR : rawData[12]
  };
};
exports.processMobData = function(rawData) {
  return {
    id : rawData[0],
    oID : rawData[1],
    cs : rawData[2],
    pos : rawData[3],
    tpos : rawData[4],
    msp : rawData[5],
    dir : rawData[6],
    rsp : rawData[7],
    at : rawData[8],
    mHP : rawData[9],
    HP : rawData[10],
    cdt : rawData[11],
    bL : rawData[12]
  };
};
exports.processMobDatas = function(rawDatas) {
  var datas = [];
  for (var i=0; i<rawDatas.length; i++) {
    datas.push(exports.processMobData(rawDatas[i]));
  }
  return datas;
};
exports.processBuffData = function(rawData) {
  return {
    oID : rawData[0],
    iP : rawData[1],
    bL : rawData[2],
    pL : rawData[3],
    aL : rawData[4]
  };
}
exports.processBuffDatas = function(rawDatas) {
  var datas = [];
  for (var i=0; i<rawDatas.length; i++) {
    datas.push(exports.processBuffData(rawDatas[i]));
  }
  return datas;
}
exports.processMobStatData = function(rawData) {
  return {
    oID : rawData[0],
    pos : rawData[1],
    dir : rawData[2],
    HP : rawData[3]
  }
}
exports.processMobBuffData = function(rawData) {
  return {
    oID : rawData[0],
    bL : rawData[1]
  }
}
exports.processObjDatas = function(rawDatas) {
  var datas = [];
  for (var i=0; i<rawDatas.length; i++) {
    var data = {};
    switch (rawDatas[i][0].substr(0, 1)) {
      case gameConfig.PREFIX_OBJECT_GOLD:
        data.oID = rawDatas[i][0];
        data.pos = rawDatas[i][1];
        data.rad = rawDatas[i][2];
        break;
      case gameConfig.PREFIX_OBJECT_JEWEL:
        data.oID = rawDatas[i][0];
        data.pos = rawDatas[i][1];
        break;
      case gameConfig.PREFIX_OBJECT_SKILL:
        data.oID = rawDatas[i][0];
        data.pos = rawDatas[i][1];
        data.pro = rawDatas[i][2];
        break;
      case gameConfig.PREFIX_OBJECT_BOX:
        data.oID = rawDatas[i][0];
        data.pos = rawDatas[i][1];
        break;
      case gameConfig.PREFIX_OBJECT_BUFF:
        data.oID = rawDatas[i][0];
        data.pos = rawDatas[i][1];
        data.rID = rawDatas[i][2];
        break;
      default:
    }
    datas.push(data);
  }
  return datas;
}

},{"../../modules/public/objectAssign.js":15,"./gameConfig.json":13,"./keyCodeTable":14,"msgpack-lite":24}],19:[function(require,module,exports){
module.exports={
  "1" : {"NAME" : "TasselsPlays", "HREF" : "https://www.youtube.com/watch?v=v4UdZjaGYLs"},
  "2" : {"NAME" : "Fady", "HREF" : "https://www.youtube.com/watch?v=zkqpXRhDW6o"}
}

},{}],20:[function(require,module,exports){
/**
 * event-lite.js - Light-weight EventEmitter (less than 1KB when gzipped)
 *
 * @copyright Yusuke Kawasaki
 * @license MIT
 * @constructor
 * @see https://github.com/kawanet/event-lite
 * @see http://kawanet.github.io/event-lite/EventLite.html
 * @example
 * var EventLite = require("event-lite");
 *
 * function MyClass() {...}             // your class
 *
 * EventLite.mixin(MyClass.prototype);  // import event methods
 *
 * var obj = new MyClass();
 * obj.on("foo", function() {...});     // add event listener
 * obj.once("bar", function() {...});   // add one-time event listener
 * obj.emit("foo");                     // dispatch event
 * obj.emit("bar");                     // dispatch another event
 * obj.off("foo");                      // remove event listener
 */

function EventLite() {
  if (!(this instanceof EventLite)) return new EventLite();
}

(function(EventLite) {
  // export the class for node.js
  if ("undefined" !== typeof module) module.exports = EventLite;

  // property name to hold listeners
  var LISTENERS = "listeners";

  // methods to export
  var methods = {
    on: on,
    once: once,
    off: off,
    emit: emit
  };

  // mixin to self
  mixin(EventLite.prototype);

  // export mixin function
  EventLite.mixin = mixin;

  /**
   * Import on(), once(), off() and emit() methods into target object.
   *
   * @function EventLite.mixin
   * @param target {Prototype}
   */

  function mixin(target) {
    for (var key in methods) {
      target[key] = methods[key];
    }
    return target;
  }

  /**
   * Add an event listener.
   *
   * @function EventLite.prototype.on
   * @param type {string}
   * @param func {Function}
   * @returns {EventLite} Self for method chaining
   */

  function on(type, func) {
    getListeners(this, type).push(func);
    return this;
  }

  /**
   * Add one-time event listener.
   *
   * @function EventLite.prototype.once
   * @param type {string}
   * @param func {Function}
   * @returns {EventLite} Self for method chaining
   */

  function once(type, func) {
    var that = this;
    wrap.originalListener = func;
    getListeners(that, type).push(wrap);
    return that;

    function wrap() {
      off.call(that, type, wrap);
      func.apply(this, arguments);
    }
  }

  /**
   * Remove an event listener.
   *
   * @function EventLite.prototype.off
   * @param [type] {string}
   * @param [func] {Function}
   * @returns {EventLite} Self for method chaining
   */

  function off(type, func) {
    var that = this;
    var listners;
    if (!arguments.length) {
      delete that[LISTENERS];
    } else if (!func) {
      listners = that[LISTENERS];
      if (listners) {
        delete listners[type];
        if (!Object.keys(listners).length) return off.call(that);
      }
    } else {
      listners = getListeners(that, type, true);
      if (listners) {
        listners = listners.filter(ne);
        if (!listners.length) return off.call(that, type);
        that[LISTENERS][type] = listners;
      }
    }
    return that;

    function ne(test) {
      return test !== func && test.originalListener !== func;
    }
  }

  /**
   * Dispatch (trigger) an event.
   *
   * @function EventLite.prototype.emit
   * @param type {string}
   * @param [value] {*}
   * @returns {boolean} True when a listener received the event
   */

  function emit(type, value) {
    var that = this;
    var listeners = getListeners(that, type, true);
    if (!listeners) return false;
    var arglen = arguments.length;
    if (arglen === 1) {
      listeners.forEach(zeroarg);
    } else if (arglen === 2) {
      listeners.forEach(onearg);
    } else {
      var args = Array.prototype.slice.call(arguments, 1);
      listeners.forEach(moreargs);
    }
    return !!listeners.length;

    function zeroarg(func) {
      func.call(that);
    }

    function onearg(func) {
      func.call(that, value);
    }

    function moreargs(func) {
      func.apply(that, args);
    }
  }

  /**
   * @ignore
   */

  function getListeners(that, type, readonly) {
    if (readonly && !that[LISTENERS]) return;
    var listeners = that[LISTENERS] || (that[LISTENERS] = {});
    return listeners[type] || (listeners[type] = []);
  }

})(EventLite);

},{}],21:[function(require,module,exports){
arguments[4][3][0].apply(exports,arguments)
},{"dup":3}],22:[function(require,module,exports){
(function (Buffer){
// int64-buffer.js

/*jshint -W018 */ // Confusing use of '!'.
/*jshint -W030 */ // Expected an assignment or function call and instead saw an expression.
/*jshint -W093 */ // Did you mean to return a conditional instead of an assignment?

var Uint64BE, Int64BE, Uint64LE, Int64LE;

!function(exports) {
  // constants

  var UNDEFINED = "undefined";
  var BUFFER = (UNDEFINED !== typeof Buffer) && Buffer;
  var UINT8ARRAY = (UNDEFINED !== typeof Uint8Array) && Uint8Array;
  var ARRAYBUFFER = (UNDEFINED !== typeof ArrayBuffer) && ArrayBuffer;
  var ZERO = [0, 0, 0, 0, 0, 0, 0, 0];
  var isArray = Array.isArray || _isArray;
  var BIT32 = 4294967296;
  var BIT24 = 16777216;

  // storage class

  var storage; // Array;

  // generate classes

  Uint64BE = factory("Uint64BE", true, true);
  Int64BE = factory("Int64BE", true, false);
  Uint64LE = factory("Uint64LE", false, true);
  Int64LE = factory("Int64LE", false, false);

  // class factory

  function factory(name, bigendian, unsigned) {
    var posH = bigendian ? 0 : 4;
    var posL = bigendian ? 4 : 0;
    var pos0 = bigendian ? 0 : 3;
    var pos1 = bigendian ? 1 : 2;
    var pos2 = bigendian ? 2 : 1;
    var pos3 = bigendian ? 3 : 0;
    var fromPositive = bigendian ? fromPositiveBE : fromPositiveLE;
    var fromNegative = bigendian ? fromNegativeBE : fromNegativeLE;
    var proto = Int64.prototype;
    var isName = "is" + name;
    var _isInt64 = "_" + isName;

    // properties
    proto.buffer = void 0;
    proto.offset = 0;
    proto[_isInt64] = true;

    // methods
    proto.toNumber = toNumber;
    proto.toString = toString;
    proto.toJSON = toNumber;
    proto.toArray = toArray;

    // add .toBuffer() method only when Buffer available
    if (BUFFER) proto.toBuffer = toBuffer;

    // add .toArrayBuffer() method only when Uint8Array available
    if (UINT8ARRAY) proto.toArrayBuffer = toArrayBuffer;

    // isUint64BE, isInt64BE
    Int64[isName] = isInt64;

    // CommonJS
    exports[name] = Int64;

    return Int64;

    // constructor
    function Int64(buffer, offset, value, raddix) {
      if (!(this instanceof Int64)) return new Int64(buffer, offset, value, raddix);
      return init(this, buffer, offset, value, raddix);
    }

    // isUint64BE, isInt64BE
    function isInt64(b) {
      return !!(b && b[_isInt64]);
    }

    // initializer
    function init(that, buffer, offset, value, raddix) {
      if (UINT8ARRAY && ARRAYBUFFER) {
        if (buffer instanceof ARRAYBUFFER) buffer = new UINT8ARRAY(buffer);
        if (value instanceof ARRAYBUFFER) value = new UINT8ARRAY(value);
      }

      // Int64BE() style
      if (!buffer && !offset && !value && !storage) {
        // shortcut to initialize with zero
        that.buffer = newArray(ZERO, 0);
        return;
      }

      // Int64BE(value, raddix) style
      if (!isValidBuffer(buffer, offset)) {
        var _storage = storage || Array;
        raddix = offset;
        value = buffer;
        offset = 0;
        buffer = new _storage(8);
      }

      that.buffer = buffer;
      that.offset = offset |= 0;

      // Int64BE(buffer, offset) style
      if (UNDEFINED === typeof value) return;

      // Int64BE(buffer, offset, value, raddix) style
      if ("string" === typeof value) {
        fromString(buffer, offset, value, raddix || 10);
      } else if (isValidBuffer(value, raddix)) {
        fromArray(buffer, offset, value, raddix);
      } else if ("number" === typeof raddix) {
        writeInt32(buffer, offset + posH, value); // high
        writeInt32(buffer, offset + posL, raddix); // low
      } else if (value > 0) {
        fromPositive(buffer, offset, value); // positive
      } else if (value < 0) {
        fromNegative(buffer, offset, value); // negative
      } else {
        fromArray(buffer, offset, ZERO, 0); // zero, NaN and others
      }
    }

    function fromString(buffer, offset, str, raddix) {
      var pos = 0;
      var len = str.length;
      var high = 0;
      var low = 0;
      if (str[0] === "-") pos++;
      var sign = pos;
      while (pos < len) {
        var chr = parseInt(str[pos++], raddix);
        if (!(chr >= 0)) break; // NaN
        low = low * raddix + chr;
        high = high * raddix + Math.floor(low / BIT32);
        low %= BIT32;
      }
      if (sign) {
        high = ~high;
        if (low) {
          low = BIT32 - low;
        } else {
          high++;
        }
      }
      writeInt32(buffer, offset + posH, high);
      writeInt32(buffer, offset + posL, low);
    }

    function toNumber() {
      var buffer = this.buffer;
      var offset = this.offset;
      var high = readInt32(buffer, offset + posH);
      var low = readInt32(buffer, offset + posL);
      if (!unsigned) high |= 0; // a trick to get signed
      return high ? (high * BIT32 + low) : low;
    }

    function toString(radix) {
      var buffer = this.buffer;
      var offset = this.offset;
      var high = readInt32(buffer, offset + posH);
      var low = readInt32(buffer, offset + posL);
      var str = "";
      var sign = !unsigned && (high & 0x80000000);
      if (sign) {
        high = ~high;
        low = BIT32 - low;
      }
      radix = radix || 10;
      while (1) {
        var mod = (high % radix) * BIT32 + low;
        high = Math.floor(high / radix);
        low = Math.floor(mod / radix);
        str = (mod % radix).toString(radix) + str;
        if (!high && !low) break;
      }
      if (sign) {
        str = "-" + str;
      }
      return str;
    }

    function writeInt32(buffer, offset, value) {
      buffer[offset + pos3] = value & 255;
      value = value >> 8;
      buffer[offset + pos2] = value & 255;
      value = value >> 8;
      buffer[offset + pos1] = value & 255;
      value = value >> 8;
      buffer[offset + pos0] = value & 255;
    }

    function readInt32(buffer, offset) {
      return (buffer[offset + pos0] * BIT24) +
        (buffer[offset + pos1] << 16) +
        (buffer[offset + pos2] << 8) +
        buffer[offset + pos3];
    }
  }

  function toArray(raw) {
    var buffer = this.buffer;
    var offset = this.offset;
    storage = null; // Array
    if (raw !== false && offset === 0 && buffer.length === 8 && isArray(buffer)) return buffer;
    return newArray(buffer, offset);
  }

  function toBuffer(raw) {
    var buffer = this.buffer;
    var offset = this.offset;
    storage = BUFFER;
    if (raw !== false && offset === 0 && buffer.length === 8 && Buffer.isBuffer(buffer)) return buffer;
    var dest = new BUFFER(8);
    fromArray(dest, 0, buffer, offset);
    return dest;
  }

  function toArrayBuffer(raw) {
    var buffer = this.buffer;
    var offset = this.offset;
    var arrbuf = buffer.buffer;
    storage = UINT8ARRAY;
    if (raw !== false && offset === 0 && (arrbuf instanceof ARRAYBUFFER) && arrbuf.byteLength === 8) return arrbuf;
    var dest = new UINT8ARRAY(8);
    fromArray(dest, 0, buffer, offset);
    return dest.buffer;
  }

  function isValidBuffer(buffer, offset) {
    var len = buffer && buffer.length;
    offset |= 0;
    return len && (offset + 8 <= len) && ("string" !== typeof buffer[offset]);
  }

  function fromArray(destbuf, destoff, srcbuf, srcoff) {
    destoff |= 0;
    srcoff |= 0;
    for (var i = 0; i < 8; i++) {
      destbuf[destoff++] = srcbuf[srcoff++] & 255;
    }
  }

  function newArray(buffer, offset) {
    return Array.prototype.slice.call(buffer, offset, offset + 8);
  }

  function fromPositiveBE(buffer, offset, value) {
    var pos = offset + 8;
    while (pos > offset) {
      buffer[--pos] = value & 255;
      value /= 256;
    }
  }

  function fromNegativeBE(buffer, offset, value) {
    var pos = offset + 8;
    value++;
    while (pos > offset) {
      buffer[--pos] = ((-value) & 255) ^ 255;
      value /= 256;
    }
  }

  function fromPositiveLE(buffer, offset, value) {
    var end = offset + 8;
    while (offset < end) {
      buffer[offset++] = value & 255;
      value /= 256;
    }
  }

  function fromNegativeLE(buffer, offset, value) {
    var end = offset + 8;
    value++;
    while (offset < end) {
      buffer[offset++] = ((-value) & 255) ^ 255;
      value /= 256;
    }
  }

  // https://github.com/retrofox/is-array
  function _isArray(val) {
    return !!val && "[object Array]" == Object.prototype.toString.call(val);
  }

}(typeof exports === 'object' && typeof exports.nodeName !== 'string' ? exports : (this || {}));

}).call(this,require("buffer").Buffer)
},{"buffer":2}],23:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],24:[function(require,module,exports){
// browser.js

exports.encode = require("./encode").encode;
exports.decode = require("./decode").decode;

exports.Encoder = require("./encoder").Encoder;
exports.Decoder = require("./decoder").Decoder;

exports.createCodec = require("./ext").createCodec;
exports.codec = require("./codec").codec;

},{"./codec":33,"./decode":35,"./decoder":36,"./encode":38,"./encoder":39,"./ext":43}],25:[function(require,module,exports){
(function (Buffer){
/* globals Buffer */

module.exports =
  c(("undefined" !== typeof Buffer) && Buffer) ||
  c(this.Buffer) ||
  c(("undefined" !== typeof window) && window.Buffer) ||
  this.Buffer;

function c(B) {
  return B && B.isBuffer && B;
}
}).call(this,require("buffer").Buffer)
},{"buffer":2}],26:[function(require,module,exports){
// buffer-lite.js

var MAXBUFLEN = 8192;

exports.copy = copy;
exports.toString = toString;
exports.write = write;

/**
 * Buffer.prototype.write()
 *
 * @param string {String}
 * @param [offset] {Number}
 * @returns {Number}
 */

function write(string, offset) {
  var buffer = this;
  var index = offset || (offset |= 0);
  var length = string.length;
  var chr = 0;
  var i = 0;
  while (i < length) {
    chr = string.charCodeAt(i++);

    if (chr < 128) {
      buffer[index++] = chr;
    } else if (chr < 0x800) {
      // 2 bytes
      buffer[index++] = 0xC0 | (chr >>> 6);
      buffer[index++] = 0x80 | (chr & 0x3F);
    } else if (chr < 0xD800 || chr > 0xDFFF) {
      // 3 bytes
      buffer[index++] = 0xE0 | (chr  >>> 12);
      buffer[index++] = 0x80 | ((chr >>> 6)  & 0x3F);
      buffer[index++] = 0x80 | (chr          & 0x3F);
    } else {
      // 4 bytes - surrogate pair
      chr = (((chr - 0xD800) << 10) | (string.charCodeAt(i++) - 0xDC00)) + 0x10000;
      buffer[index++] = 0xF0 | (chr >>> 18);
      buffer[index++] = 0x80 | ((chr >>> 12) & 0x3F);
      buffer[index++] = 0x80 | ((chr >>> 6)  & 0x3F);
      buffer[index++] = 0x80 | (chr          & 0x3F);
    }
  }
  return index - offset;
}

/**
 * Buffer.prototype.toString()
 *
 * @param [encoding] {String} ignored
 * @param [start] {Number}
 * @param [end] {Number}
 * @returns {String}
 */

function toString(encoding, start, end) {
  var buffer = this;
  var index = start|0;
  if (!end) end = buffer.length;
  var string = '';
  var chr = 0;

  while (index < end) {
    chr = buffer[index++];
    if (chr < 128) {
      string += String.fromCharCode(chr);
      continue;
    }

    if ((chr & 0xE0) === 0xC0) {
      // 2 bytes
      chr = (chr & 0x1F) << 6 |
            (buffer[index++] & 0x3F);

    } else if ((chr & 0xF0) === 0xE0) {
      // 3 bytes
      chr = (chr & 0x0F)             << 12 |
            (buffer[index++] & 0x3F) << 6  |
            (buffer[index++] & 0x3F);

    } else if ((chr & 0xF8) === 0xF0) {
      // 4 bytes
      chr = (chr & 0x07)             << 18 |
            (buffer[index++] & 0x3F) << 12 |
            (buffer[index++] & 0x3F) << 6  |
            (buffer[index++] & 0x3F);
    }

    if (chr >= 0x010000) {
      // A surrogate pair
      chr -= 0x010000;

      string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
    } else {
      string += String.fromCharCode(chr);
    }
  }

  return string;
}

/**
 * Buffer.prototype.copy()
 *
 * @param target {Buffer}
 * @param [targetStart] {Number}
 * @param [start] {Number}
 * @param [end] {Number}
 * @returns {number}
 */

function copy(target, targetStart, start, end) {
  var i;
  if (!start) start = 0;
  if (!end && end !== 0) end = this.length;
  if (!targetStart) targetStart = 0;
  var len = end - start;

  if (target === this && start < targetStart && targetStart < end) {
    // descending
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start];
    }
  } else {
    // ascending
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start];
    }
  }

  return len;
}

},{}],27:[function(require,module,exports){
// bufferish-array.js

var Bufferish = require("./bufferish");

var exports = module.exports = alloc(0);

exports.alloc = alloc;
exports.concat = Bufferish.concat;
exports.from = from;

/**
 * @param size {Number}
 * @returns {Buffer|Uint8Array|Array}
 */

function alloc(size) {
  return new Array(size);
}

/**
 * @param value {Array|ArrayBuffer|Buffer|String}
 * @returns {Array}
 */

function from(value) {
  if (!Bufferish.isBuffer(value) && Bufferish.isView(value)) {
    // TypedArray to Uint8Array
    value = Bufferish.Uint8Array.from(value);
  } else if (Bufferish.isArrayBuffer(value)) {
    // ArrayBuffer to Uint8Array
    value = new Uint8Array(value);
  } else if (typeof value === "string") {
    // String to Array
    return Bufferish.from.call(exports, value);
  } else if (typeof value === "number") {
    throw new TypeError('"value" argument must not be a number');
  }

  // Array-like to Array
  return Array.prototype.slice.call(value);
}

},{"./bufferish":31}],28:[function(require,module,exports){
// bufferish-buffer.js

var Bufferish = require("./bufferish");
var Buffer = Bufferish.global;

var exports = module.exports = Bufferish.hasBuffer ? alloc(0) : [];

exports.alloc = Bufferish.hasBuffer && Buffer.alloc || alloc;
exports.concat = Bufferish.concat;
exports.from = from;

/**
 * @param size {Number}
 * @returns {Buffer|Uint8Array|Array}
 */

function alloc(size) {
  return new Buffer(size);
}

/**
 * @param value {Array|ArrayBuffer|Buffer|String}
 * @returns {Buffer}
 */

function from(value) {
  if (!Bufferish.isBuffer(value) && Bufferish.isView(value)) {
    // TypedArray to Uint8Array
    value = Bufferish.Uint8Array.from(value);
  } else if (Bufferish.isArrayBuffer(value)) {
    // ArrayBuffer to Uint8Array
    value = new Uint8Array(value);
  } else if (typeof value === "string") {
    // String to Buffer
    return Bufferish.from.call(exports, value);
  } else if (typeof value === "number") {
    throw new TypeError('"value" argument must not be a number');
  }

  // Array-like to Buffer
  if (Buffer.from && Buffer.from.length !== 1) {
    return Buffer.from(value); // node v6+
  } else {
    return new Buffer(value); // node v4
  }
}

},{"./bufferish":31}],29:[function(require,module,exports){
// bufferish-proto.js

/* jshint eqnull:true */

var BufferLite = require("./buffer-lite");

exports.copy = copy;
exports.slice = slice;
exports.toString = toString;
exports.write = gen("write");

var Bufferish = require("./bufferish");
var Buffer = Bufferish.global;

var isBufferShim = Bufferish.hasBuffer && ("TYPED_ARRAY_SUPPORT" in Buffer);
var brokenTypedArray = isBufferShim && !Buffer.TYPED_ARRAY_SUPPORT;

/**
 * @param target {Buffer|Uint8Array|Array}
 * @param [targetStart] {Number}
 * @param [start] {Number}
 * @param [end] {Number}
 * @returns {Buffer|Uint8Array|Array}
 */

function copy(target, targetStart, start, end) {
  var thisIsBuffer = Bufferish.isBuffer(this);
  var targetIsBuffer = Bufferish.isBuffer(target);
  if (thisIsBuffer && targetIsBuffer) {
    // Buffer to Buffer
    return this.copy(target, targetStart, start, end);
  } else if (!brokenTypedArray && !thisIsBuffer && !targetIsBuffer &&
    Bufferish.isView(this) && Bufferish.isView(target)) {
    // Uint8Array to Uint8Array (except for minor some browsers)
    var buffer = (start || end != null) ? slice.call(this, start, end) : this;
    target.set(buffer, targetStart);
    return buffer.length;
  } else {
    // other cases
    return BufferLite.copy.call(this, target, targetStart, start, end);
  }
}

/**
 * @param [start] {Number}
 * @param [end] {Number}
 * @returns {Buffer|Uint8Array|Array}
 */

function slice(start, end) {
  // for Buffer, Uint8Array (except for minor some browsers) and Array
  var f = this.slice || (!brokenTypedArray && this.subarray);
  if (f) return f.call(this, start, end);

  // Uint8Array (for minor some browsers)
  var target = Bufferish.alloc.call(this, end - start);
  copy.call(this, target, 0, start, end);
  return target;
}

/**
 * Buffer.prototype.toString()
 *
 * @param [encoding] {String} ignored
 * @param [start] {Number}
 * @param [end] {Number}
 * @returns {String}
 */

function toString(encoding, start, end) {
  var f = (!isBufferShim && Bufferish.isBuffer(this)) ? this.toString : BufferLite.toString;
  return f.apply(this, arguments);
}

/**
 * @private
 */

function gen(method) {
  return wrap;

  function wrap() {
    var f = this[method] || BufferLite[method];
    return f.apply(this, arguments);
  }
}

},{"./buffer-lite":26,"./bufferish":31}],30:[function(require,module,exports){
// bufferish-uint8array.js

var Bufferish = require("./bufferish");

var exports = module.exports = Bufferish.hasArrayBuffer ? alloc(0) : [];

exports.alloc = alloc;
exports.concat = Bufferish.concat;
exports.from = from;

/**
 * @param size {Number}
 * @returns {Buffer|Uint8Array|Array}
 */

function alloc(size) {
  return new Uint8Array(size);
}

/**
 * @param value {Array|ArrayBuffer|Buffer|String}
 * @returns {Uint8Array}
 */

function from(value) {
  if (Bufferish.isView(value)) {
    // TypedArray to ArrayBuffer
    var byteOffset = value.byteOffset;
    var byteLength = value.byteLength;
    value = value.buffer;
    if (value.byteLength !== byteLength) {
      if (value.slice) {
        value = value.slice(byteOffset, byteOffset + byteLength);
      } else {
        // Android 4.1 does not have ArrayBuffer.prototype.slice
        value = new Uint8Array(value);
        if (value.byteLength !== byteLength) {
          // TypedArray to ArrayBuffer to Uint8Array to Array
          value = Array.prototype.slice.call(value, byteOffset, byteOffset + byteLength);
        }
      }
    }
  } else if (typeof value === "string") {
    // String to Uint8Array
    return Bufferish.from.call(exports, value);
  } else if (typeof value === "number") {
    throw new TypeError('"value" argument must not be a number');
  }

  return new Uint8Array(value);
}

},{"./bufferish":31}],31:[function(require,module,exports){
// bufferish.js

var Buffer = exports.global = require("./buffer-global");
var hasBuffer = exports.hasBuffer = Buffer && !!Buffer.isBuffer;
var hasArrayBuffer = exports.hasArrayBuffer = ("undefined" !== typeof ArrayBuffer);

var isArray = exports.isArray = require("isarray");
exports.isArrayBuffer = hasArrayBuffer ? isArrayBuffer : _false;
var isBuffer = exports.isBuffer = hasBuffer ? Buffer.isBuffer : _false;
var isView = exports.isView = hasArrayBuffer ? (ArrayBuffer.isView || _is("ArrayBuffer", "buffer")) : _false;

exports.alloc = alloc;
exports.concat = concat;
exports.from = from;

var BufferArray = exports.Array = require("./bufferish-array");
var BufferBuffer = exports.Buffer = require("./bufferish-buffer");
var BufferUint8Array = exports.Uint8Array = require("./bufferish-uint8array");
var BufferProto = exports.prototype = require("./bufferish-proto");

/**
 * @param value {Array|ArrayBuffer|Buffer|String}
 * @returns {Buffer|Uint8Array|Array}
 */

function from(value) {
  if (typeof value === "string") {
    return fromString.call(this, value);
  } else {
    return auto(this).from(value);
  }
}

/**
 * @param size {Number}
 * @returns {Buffer|Uint8Array|Array}
 */

function alloc(size) {
  return auto(this).alloc(size);
}

/**
 * @param list {Array} array of (Buffer|Uint8Array|Array)s
 * @param [length]
 * @returns {Buffer|Uint8Array|Array}
 */

function concat(list, length) {
  if (!length) {
    length = 0;
    Array.prototype.forEach.call(list, dryrun);
  }
  var ref = (this !== exports) && this || list[0];
  var result = alloc.call(ref, length);
  var offset = 0;
  Array.prototype.forEach.call(list, append);
  return result;

  function dryrun(buffer) {
    length += buffer.length;
  }

  function append(buffer) {
    offset += BufferProto.copy.call(buffer, result, offset);
  }
}

var _isArrayBuffer = _is("ArrayBuffer");

function isArrayBuffer(value) {
  return (value instanceof ArrayBuffer) || _isArrayBuffer(value);
}

/**
 * @private
 */

function fromString(value) {
  var expected = value.length * 3;
  var that = alloc.call(this, expected);
  var actual = BufferProto.write.call(that, value);
  if (expected !== actual) {
    that = BufferProto.slice.call(that, 0, actual);
  }
  return that;
}

function auto(that) {
  return isBuffer(that) ? BufferBuffer
    : isView(that) ? BufferUint8Array
    : isArray(that) ? BufferArray
    : hasBuffer ? BufferBuffer
    : hasArrayBuffer ? BufferUint8Array
    : BufferArray;
}

function _false() {
  return false;
}

function _is(name, key) {
  /* jshint eqnull:true */
  name = "[object " + name + "]";
  return function(value) {
    return (value != null) && {}.toString.call(key ? value[key] : value) === name;
  };
}
},{"./buffer-global":25,"./bufferish-array":27,"./bufferish-buffer":28,"./bufferish-proto":29,"./bufferish-uint8array":30,"isarray":23}],32:[function(require,module,exports){
// codec-base.js

var IS_ARRAY = require("isarray");

exports.createCodec = createCodec;
exports.install = install;
exports.filter = filter;

var Bufferish = require("./bufferish");

function Codec(options) {
  if (!(this instanceof Codec)) return new Codec(options);
  this.options = options;
  this.init();
}

Codec.prototype.init = function() {
  var options = this.options;

  if (options && options.uint8array) {
    this.bufferish = Bufferish.Uint8Array;
  }

  return this;
};

function install(props) {
  for (var key in props) {
    Codec.prototype[key] = add(Codec.prototype[key], props[key]);
  }
}

function add(a, b) {
  return (a && b) ? ab : (a || b);

  function ab() {
    a.apply(this, arguments);
    return b.apply(this, arguments);
  }
}

function join(filters) {
  filters = filters.slice();

  return function(value) {
    return filters.reduce(iterator, value);
  };

  function iterator(value, filter) {
    return filter(value);
  }
}

function filter(filter) {
  return IS_ARRAY(filter) ? join(filter) : filter;
}

// @public
// msgpack.createCodec()

function createCodec(options) {
  return new Codec(options);
}

// default shared codec

exports.preset = createCodec({preset: true});

},{"./bufferish":31,"isarray":23}],33:[function(require,module,exports){
// codec.js

// load both interfaces
require("./read-core");
require("./write-core");

// @public
// msgpack.codec.preset

exports.codec = {
  preset: require("./codec-base").preset
};

},{"./codec-base":32,"./read-core":45,"./write-core":48}],34:[function(require,module,exports){
// decode-buffer.js

exports.DecodeBuffer = DecodeBuffer;

var preset = require("./read-core").preset;

var FlexDecoder = require("./flex-buffer").FlexDecoder;

FlexDecoder.mixin(DecodeBuffer.prototype);

function DecodeBuffer(options) {
  if (!(this instanceof DecodeBuffer)) return new DecodeBuffer(options);

  if (options) {
    this.options = options;
    if (options.codec) {
      var codec = this.codec = options.codec;
      if (codec.bufferish) this.bufferish = codec.bufferish;
    }
  }
}

DecodeBuffer.prototype.codec = preset;

DecodeBuffer.prototype.fetch = function() {
  return this.codec.decode(this);
};

},{"./flex-buffer":44,"./read-core":45}],35:[function(require,module,exports){
// decode.js

exports.decode = decode;

var DecodeBuffer = require("./decode-buffer").DecodeBuffer;

function decode(input, options) {
  var decoder = new DecodeBuffer(options);
  decoder.write(input);
  return decoder.read();
}
},{"./decode-buffer":34}],36:[function(require,module,exports){
// decoder.js

exports.Decoder = Decoder;

var EventLite = require("event-lite");
var DecodeBuffer = require("./decode-buffer").DecodeBuffer;

function Decoder(options) {
  if (!(this instanceof Decoder)) return new Decoder(options);
  DecodeBuffer.call(this, options);
}

Decoder.prototype = new DecodeBuffer();

EventLite.mixin(Decoder.prototype);

Decoder.prototype.decode = function(chunk) {
  if (arguments.length) this.write(chunk);
  this.flush();
};

Decoder.prototype.push = function(chunk) {
  this.emit("data", chunk);
};

Decoder.prototype.end = function(chunk) {
  this.decode(chunk);
  this.emit("end");
};

},{"./decode-buffer":34,"event-lite":20}],37:[function(require,module,exports){
// encode-buffer.js

exports.EncodeBuffer = EncodeBuffer;

var preset = require("./write-core").preset;

var FlexEncoder = require("./flex-buffer").FlexEncoder;

FlexEncoder.mixin(EncodeBuffer.prototype);

function EncodeBuffer(options) {
  if (!(this instanceof EncodeBuffer)) return new EncodeBuffer(options);

  if (options) {
    this.options = options;
    if (options.codec) {
      var codec = this.codec = options.codec;
      if (codec.bufferish) this.bufferish = codec.bufferish;
    }
  }
}

EncodeBuffer.prototype.codec = preset;

EncodeBuffer.prototype.write = function(input) {
  this.codec.encode(this, input);
};

},{"./flex-buffer":44,"./write-core":48}],38:[function(require,module,exports){
// encode.js

exports.encode = encode;

var EncodeBuffer = require("./encode-buffer").EncodeBuffer;

function encode(input, options) {
  var encoder = new EncodeBuffer(options);
  encoder.write(input);
  return encoder.read();
}

},{"./encode-buffer":37}],39:[function(require,module,exports){
// encoder.js

exports.Encoder = Encoder;

var EventLite = require("event-lite");
var EncodeBuffer = require("./encode-buffer").EncodeBuffer;

function Encoder(options) {
  if (!(this instanceof Encoder)) return new Encoder(options);
  EncodeBuffer.call(this, options);
}

Encoder.prototype = new EncodeBuffer();

EventLite.mixin(Encoder.prototype);

Encoder.prototype.encode = function(chunk) {
  this.write(chunk);
  this.emit("data", this.read());
};

Encoder.prototype.end = function(chunk) {
  if (arguments.length) this.encode(chunk);
  this.flush();
  this.emit("end");
};

},{"./encode-buffer":37,"event-lite":20}],40:[function(require,module,exports){
// ext-buffer.js

exports.ExtBuffer = ExtBuffer;

var Bufferish = require("./bufferish");

function ExtBuffer(buffer, type) {
  if (!(this instanceof ExtBuffer)) return new ExtBuffer(buffer, type);
  this.buffer = Bufferish.from(buffer);
  this.type = type;
}

},{"./bufferish":31}],41:[function(require,module,exports){
// ext-packer.js

exports.setExtPackers = setExtPackers;

var Bufferish = require("./bufferish");
var Buffer = Bufferish.global;
var packTypedArray = Bufferish.Uint8Array.from;
var _encode;

var ERROR_COLUMNS = {name: 1, message: 1, stack: 1, columnNumber: 1, fileName: 1, lineNumber: 1};

function setExtPackers(codec) {
  codec.addExtPacker(0x0E, Error, [packError, encode]);
  codec.addExtPacker(0x01, EvalError, [packError, encode]);
  codec.addExtPacker(0x02, RangeError, [packError, encode]);
  codec.addExtPacker(0x03, ReferenceError, [packError, encode]);
  codec.addExtPacker(0x04, SyntaxError, [packError, encode]);
  codec.addExtPacker(0x05, TypeError, [packError, encode]);
  codec.addExtPacker(0x06, URIError, [packError, encode]);

  codec.addExtPacker(0x0A, RegExp, [packRegExp, encode]);
  codec.addExtPacker(0x0B, Boolean, [packValueOf, encode]);
  codec.addExtPacker(0x0C, String, [packValueOf, encode]);
  codec.addExtPacker(0x0D, Date, [Number, encode]);
  codec.addExtPacker(0x0F, Number, [packValueOf, encode]);

  if ("undefined" !== typeof Uint8Array) {
    codec.addExtPacker(0x11, Int8Array, packTypedArray);
    codec.addExtPacker(0x12, Uint8Array, packTypedArray);
    codec.addExtPacker(0x13, Int16Array, packTypedArray);
    codec.addExtPacker(0x14, Uint16Array, packTypedArray);
    codec.addExtPacker(0x15, Int32Array, packTypedArray);
    codec.addExtPacker(0x16, Uint32Array, packTypedArray);
    codec.addExtPacker(0x17, Float32Array, packTypedArray);

    // PhantomJS/1.9.7 doesn't have Float64Array
    if ("undefined" !== typeof Float64Array) {
      codec.addExtPacker(0x18, Float64Array, packTypedArray);
    }

    // IE10 doesn't have Uint8ClampedArray
    if ("undefined" !== typeof Uint8ClampedArray) {
      codec.addExtPacker(0x19, Uint8ClampedArray, packTypedArray);
    }

    codec.addExtPacker(0x1A, ArrayBuffer, packTypedArray);
    codec.addExtPacker(0x1D, DataView, packTypedArray);
  }

  if (Bufferish.hasBuffer) {
    codec.addExtPacker(0x1B, Buffer, Bufferish.from);
  }
}

function encode(input) {
  if (!_encode) _encode = require("./encode").encode; // lazy load
  return _encode(input);
}

function packValueOf(value) {
  return (value).valueOf();
}

function packRegExp(value) {
  value = RegExp.prototype.toString.call(value).split("/");
  value.shift();
  var out = [value.pop()];
  out.unshift(value.join("/"));
  return out;
}

function packError(value) {
  var out = {};
  for (var key in ERROR_COLUMNS) {
    out[key] = value[key];
  }
  return out;
}

},{"./bufferish":31,"./encode":38}],42:[function(require,module,exports){
// ext-unpacker.js

exports.setExtUnpackers = setExtUnpackers;

var Bufferish = require("./bufferish");
var Buffer = Bufferish.global;
var _decode;

var ERROR_COLUMNS = {name: 1, message: 1, stack: 1, columnNumber: 1, fileName: 1, lineNumber: 1};

function setExtUnpackers(codec) {
  codec.addExtUnpacker(0x0E, [decode, unpackError(Error)]);
  codec.addExtUnpacker(0x01, [decode, unpackError(EvalError)]);
  codec.addExtUnpacker(0x02, [decode, unpackError(RangeError)]);
  codec.addExtUnpacker(0x03, [decode, unpackError(ReferenceError)]);
  codec.addExtUnpacker(0x04, [decode, unpackError(SyntaxError)]);
  codec.addExtUnpacker(0x05, [decode, unpackError(TypeError)]);
  codec.addExtUnpacker(0x06, [decode, unpackError(URIError)]);

  codec.addExtUnpacker(0x0A, [decode, unpackRegExp]);
  codec.addExtUnpacker(0x0B, [decode, unpackClass(Boolean)]);
  codec.addExtUnpacker(0x0C, [decode, unpackClass(String)]);
  codec.addExtUnpacker(0x0D, [decode, unpackClass(Date)]);
  codec.addExtUnpacker(0x0F, [decode, unpackClass(Number)]);

  if ("undefined" !== typeof Uint8Array) {
    codec.addExtUnpacker(0x11, unpackClass(Int8Array));
    codec.addExtUnpacker(0x12, unpackClass(Uint8Array));
    codec.addExtUnpacker(0x13, [unpackArrayBuffer, unpackClass(Int16Array)]);
    codec.addExtUnpacker(0x14, [unpackArrayBuffer, unpackClass(Uint16Array)]);
    codec.addExtUnpacker(0x15, [unpackArrayBuffer, unpackClass(Int32Array)]);
    codec.addExtUnpacker(0x16, [unpackArrayBuffer, unpackClass(Uint32Array)]);
    codec.addExtUnpacker(0x17, [unpackArrayBuffer, unpackClass(Float32Array)]);

    // PhantomJS/1.9.7 doesn't have Float64Array
    if ("undefined" !== typeof Float64Array) {
      codec.addExtUnpacker(0x18, [unpackArrayBuffer, unpackClass(Float64Array)]);
    }

    // IE10 doesn't have Uint8ClampedArray
    if ("undefined" !== typeof Uint8ClampedArray) {
      codec.addExtUnpacker(0x19, unpackClass(Uint8ClampedArray));
    }

    codec.addExtUnpacker(0x1A, unpackArrayBuffer);
    codec.addExtUnpacker(0x1D, [unpackArrayBuffer, unpackClass(DataView)]);
  }

  if (Bufferish.hasBuffer) {
    codec.addExtUnpacker(0x1B, unpackClass(Buffer));
  }
}

function decode(input) {
  if (!_decode) _decode = require("./decode").decode; // lazy load
  return _decode(input);
}

function unpackRegExp(value) {
  return RegExp.apply(null, value);
}

function unpackError(Class) {
  return function(value) {
    var out = new Class();
    for (var key in ERROR_COLUMNS) {
      out[key] = value[key];
    }
    return out;
  };
}

function unpackClass(Class) {
  return function(value) {
    return new Class(value);
  };
}

function unpackArrayBuffer(value) {
  return (new Uint8Array(value)).buffer;
}

},{"./bufferish":31,"./decode":35}],43:[function(require,module,exports){
// ext.js

// load both interfaces
require("./read-core");
require("./write-core");

exports.createCodec = require("./codec-base").createCodec;

},{"./codec-base":32,"./read-core":45,"./write-core":48}],44:[function(require,module,exports){
// flex-buffer.js

exports.FlexDecoder = FlexDecoder;
exports.FlexEncoder = FlexEncoder;

var Bufferish = require("./bufferish");

var MIN_BUFFER_SIZE = 2048;
var MAX_BUFFER_SIZE = 65536;
var BUFFER_SHORTAGE = "BUFFER_SHORTAGE";

function FlexDecoder() {
  if (!(this instanceof FlexDecoder)) return new FlexDecoder();
}

function FlexEncoder() {
  if (!(this instanceof FlexEncoder)) return new FlexEncoder();
}

FlexDecoder.mixin = mixinFactory(getDecoderMethods());
FlexDecoder.mixin(FlexDecoder.prototype);

FlexEncoder.mixin = mixinFactory(getEncoderMethods());
FlexEncoder.mixin(FlexEncoder.prototype);

function getDecoderMethods() {
  return {
    bufferish: Bufferish,
    write: write,
    fetch: fetch,
    flush: flush,
    push: push,
    pull: pull,
    read: read,
    reserve: reserve,
    offset: 0
  };

  function write(chunk) {
    var prev = this.offset ? Bufferish.prototype.slice.call(this.buffer, this.offset) : this.buffer;
    this.buffer = prev ? (chunk ? this.bufferish.concat([prev, chunk]) : prev) : chunk;
    this.offset = 0;
  }

  function flush() {
    while (this.offset < this.buffer.length) {
      var start = this.offset;
      var value;
      try {
        value = this.fetch();
      } catch (e) {
        if (e && e.message != BUFFER_SHORTAGE) throw e;
        // rollback
        this.offset = start;
        break;
      }
      this.push(value);
    }
  }

  function reserve(length) {
    var start = this.offset;
    var end = start + length;
    if (end > this.buffer.length) throw new Error(BUFFER_SHORTAGE);
    this.offset = end;
    return start;
  }
}

function getEncoderMethods() {
  return {
    bufferish: Bufferish,
    write: write,
    fetch: fetch,
    flush: flush,
    push: push,
    pull: pull,
    read: read,
    reserve: reserve,
    send: send,
    maxBufferSize: MAX_BUFFER_SIZE,
    minBufferSize: MIN_BUFFER_SIZE,
    offset: 0,
    start: 0
  };

  function fetch() {
    var start = this.start;
    if (start < this.offset) {
      var end = this.start = this.offset;
      return Bufferish.prototype.slice.call(this.buffer, start, end);
    }
  }

  function flush() {
    while (this.start < this.offset) {
      var value = this.fetch();
      if (value) this.push(value);
    }
  }

  function pull() {
    var buffers = this.buffers || (this.buffers = []);
    var chunk = buffers.length > 1 ? this.bufferish.concat(buffers) : buffers[0];
    buffers.length = 0; // buffer exhausted
    return chunk;
  }

  function reserve(length) {
    var req = length | 0;

    if (this.buffer) {
      var size = this.buffer.length;
      var start = this.offset | 0;
      var end = start + req;

      // is it long enough?
      if (end < size) {
        this.offset = end;
        return start;
      }

      // flush current buffer
      this.flush();

      // resize it to 2x current length
      length = Math.max(length, Math.min(size * 2, this.maxBufferSize));
    }

    // minimum buffer size
    length = Math.max(length, this.minBufferSize);

    // allocate new buffer
    this.buffer = this.bufferish.alloc(length);
    this.start = 0;
    this.offset = req;
    return 0;
  }

  function send(buffer) {
    var length = buffer.length;
    if (length > this.minBufferSize) {
      this.flush();
      this.push(buffer);
    } else {
      var offset = this.reserve(length);
      Bufferish.prototype.copy.call(buffer, this.buffer, offset);
    }
  }
}

// common methods

function write() {
  throw new Error("method not implemented: write()");
}

function fetch() {
  throw new Error("method not implemented: fetch()");
}

function read() {
  var length = this.buffers && this.buffers.length;

  // fetch the first result
  if (!length) return this.fetch();

  // flush current buffer
  this.flush();

  // read from the results
  return this.pull();
}

function push(chunk) {
  var buffers = this.buffers || (this.buffers = []);
  buffers.push(chunk);
}

function pull() {
  var buffers = this.buffers || (this.buffers = []);
  return buffers.shift();
}

function mixinFactory(source) {
  return mixin;

  function mixin(target) {
    for (var key in source) {
      target[key] = source[key];
    }
    return target;
  }
}

},{"./bufferish":31}],45:[function(require,module,exports){
// read-core.js

var ExtBuffer = require("./ext-buffer").ExtBuffer;
var ExtUnpacker = require("./ext-unpacker");
var readUint8 = require("./read-format").readUint8;
var ReadToken = require("./read-token");
var CodecBase = require("./codec-base");

CodecBase.install({
  addExtUnpacker: addExtUnpacker,
  getExtUnpacker: getExtUnpacker,
  init: init
});

exports.preset = init.call(CodecBase.preset);

function getDecoder(options) {
  var readToken = ReadToken.getReadToken(options);
  return decode;

  function decode(decoder) {
    var type = readUint8(decoder);
    var func = readToken[type];
    if (!func) throw new Error("Invalid type: " + (type ? ("0x" + type.toString(16)) : type));
    return func(decoder);
  }
}

function init() {
  var options = this.options;
  this.decode = getDecoder(options);

  if (options && options.preset) {
    ExtUnpacker.setExtUnpackers(this);
  }

  return this;
}

function addExtUnpacker(etype, unpacker) {
  var unpackers = this.extUnpackers || (this.extUnpackers = []);
  unpackers[etype] = CodecBase.filter(unpacker);
}

function getExtUnpacker(type) {
  var unpackers = this.extUnpackers || (this.extUnpackers = []);
  return unpackers[type] || extUnpacker;

  function extUnpacker(buffer) {
    return new ExtBuffer(buffer, type);
  }
}

},{"./codec-base":32,"./ext-buffer":40,"./ext-unpacker":42,"./read-format":46,"./read-token":47}],46:[function(require,module,exports){
// read-format.js

var ieee754 = require("ieee754");
var Int64Buffer = require("int64-buffer");
var Uint64BE = Int64Buffer.Uint64BE;
var Int64BE = Int64Buffer.Int64BE;

exports.getReadFormat = getReadFormat;
exports.readUint8 = uint8;

var Bufferish = require("./bufferish");
var BufferProto = require("./bufferish-proto");

var HAS_MAP = ("undefined" !== typeof Map);
var NO_ASSERT = true;

function getReadFormat(options) {
  var binarraybuffer = Bufferish.hasArrayBuffer && options && options.binarraybuffer;
  var int64 = options && options.int64;
  var usemap = HAS_MAP && options && options.usemap;

  var readFormat = {
    map: (usemap ? map_to_map : map_to_obj),
    array: array,
    str: str,
    bin: (binarraybuffer ? bin_arraybuffer : bin_buffer),
    ext: ext,
    uint8: uint8,
    uint16: uint16,
    uint32: uint32,
    uint64: read(8, int64 ? readUInt64BE_int64 : readUInt64BE),
    int8: int8,
    int16: int16,
    int32: int32,
    int64: read(8, int64 ? readInt64BE_int64 : readInt64BE),
    float32: read(4, readFloatBE),
    float64: read(8, readDoubleBE)
  };

  return readFormat;
}

function map_to_obj(decoder, len) {
  var value = {};
  var i;
  var k = new Array(len);
  var v = new Array(len);

  var decode = decoder.codec.decode;
  for (i = 0; i < len; i++) {
    k[i] = decode(decoder);
    v[i] = decode(decoder);
  }
  for (i = 0; i < len; i++) {
    value[k[i]] = v[i];
  }
  return value;
}

function map_to_map(decoder, len) {
  var value = new Map();
  var i;
  var k = new Array(len);
  var v = new Array(len);

  var decode = decoder.codec.decode;
  for (i = 0; i < len; i++) {
    k[i] = decode(decoder);
    v[i] = decode(decoder);
  }
  for (i = 0; i < len; i++) {
    value.set(k[i], v[i]);
  }
  return value;
}

function array(decoder, len) {
  var value = new Array(len);
  var decode = decoder.codec.decode;
  for (var i = 0; i < len; i++) {
    value[i] = decode(decoder);
  }
  return value;
}

function str(decoder, len) {
  var start = decoder.reserve(len);
  var end = start + len;
  return BufferProto.toString.call(decoder.buffer, "utf-8", start, end);
}

function bin_buffer(decoder, len) {
  var start = decoder.reserve(len);
  var end = start + len;
  var buf = BufferProto.slice.call(decoder.buffer, start, end);
  return Bufferish.from(buf);
}

function bin_arraybuffer(decoder, len) {
  var start = decoder.reserve(len);
  var end = start + len;
  var buf = BufferProto.slice.call(decoder.buffer, start, end);
  return Bufferish.Uint8Array.from(buf).buffer;
}

function ext(decoder, len) {
  var start = decoder.reserve(len+1);
  var type = decoder.buffer[start++];
  var end = start + len;
  var unpack = decoder.codec.getExtUnpacker(type);
  if (!unpack) throw new Error("Invalid ext type: " + (type ? ("0x" + type.toString(16)) : type));
  var buf = BufferProto.slice.call(decoder.buffer, start, end);
  return unpack(buf);
}

function uint8(decoder) {
  var start = decoder.reserve(1);
  return decoder.buffer[start];
}

function int8(decoder) {
  var start = decoder.reserve(1);
  var value = decoder.buffer[start];
  return (value & 0x80) ? value - 0x100 : value;
}

function uint16(decoder) {
  var start = decoder.reserve(2);
  var buffer = decoder.buffer;
  return (buffer[start++] << 8) | buffer[start];
}

function int16(decoder) {
  var start = decoder.reserve(2);
  var buffer = decoder.buffer;
  var value = (buffer[start++] << 8) | buffer[start];
  return (value & 0x8000) ? value - 0x10000 : value;
}

function uint32(decoder) {
  var start = decoder.reserve(4);
  var buffer = decoder.buffer;
  return (buffer[start++] * 16777216) + (buffer[start++] << 16) + (buffer[start++] << 8) + buffer[start];
}

function int32(decoder) {
  var start = decoder.reserve(4);
  var buffer = decoder.buffer;
  return (buffer[start++] << 24) | (buffer[start++] << 16) | (buffer[start++] << 8) | buffer[start];
}

function read(len, method) {
  return function(decoder) {
    var start = decoder.reserve(len);
    return method.call(decoder.buffer, start, NO_ASSERT);
  };
}

function readUInt64BE(start) {
  return new Uint64BE(this, start).toNumber();
}

function readInt64BE(start) {
  return new Int64BE(this, start).toNumber();
}

function readUInt64BE_int64(start) {
  return new Uint64BE(this, start);
}

function readInt64BE_int64(start) {
  return new Int64BE(this, start);
}

function readFloatBE(start) {
  return ieee754.read(this, start, false, 23, 4);
}

function readDoubleBE(start) {
  return ieee754.read(this, start, false, 52, 8);
}
},{"./bufferish":31,"./bufferish-proto":29,"ieee754":21,"int64-buffer":22}],47:[function(require,module,exports){
// read-token.js

var ReadFormat = require("./read-format");

exports.getReadToken = getReadToken;

function getReadToken(options) {
  var format = ReadFormat.getReadFormat(options);

  if (options && options.useraw) {
    return init_useraw(format);
  } else {
    return init_token(format);
  }
}

function init_token(format) {
  var i;
  var token = new Array(256);

  // positive fixint -- 0x00 - 0x7f
  for (i = 0x00; i <= 0x7f; i++) {
    token[i] = constant(i);
  }

  // fixmap -- 0x80 - 0x8f
  for (i = 0x80; i <= 0x8f; i++) {
    token[i] = fix(i - 0x80, format.map);
  }

  // fixarray -- 0x90 - 0x9f
  for (i = 0x90; i <= 0x9f; i++) {
    token[i] = fix(i - 0x90, format.array);
  }

  // fixstr -- 0xa0 - 0xbf
  for (i = 0xa0; i <= 0xbf; i++) {
    token[i] = fix(i - 0xa0, format.str);
  }

  // nil -- 0xc0
  token[0xc0] = constant(null);

  // (never used) -- 0xc1
  token[0xc1] = null;

  // false -- 0xc2
  // true -- 0xc3
  token[0xc2] = constant(false);
  token[0xc3] = constant(true);

  // bin 8 -- 0xc4
  // bin 16 -- 0xc5
  // bin 32 -- 0xc6
  token[0xc4] = flex(format.uint8, format.bin);
  token[0xc5] = flex(format.uint16, format.bin);
  token[0xc6] = flex(format.uint32, format.bin);

  // ext 8 -- 0xc7
  // ext 16 -- 0xc8
  // ext 32 -- 0xc9
  token[0xc7] = flex(format.uint8, format.ext);
  token[0xc8] = flex(format.uint16, format.ext);
  token[0xc9] = flex(format.uint32, format.ext);

  // float 32 -- 0xca
  // float 64 -- 0xcb
  token[0xca] = format.float32;
  token[0xcb] = format.float64;

  // uint 8 -- 0xcc
  // uint 16 -- 0xcd
  // uint 32 -- 0xce
  // uint 64 -- 0xcf
  token[0xcc] = format.uint8;
  token[0xcd] = format.uint16;
  token[0xce] = format.uint32;
  token[0xcf] = format.uint64;

  // int 8 -- 0xd0
  // int 16 -- 0xd1
  // int 32 -- 0xd2
  // int 64 -- 0xd3
  token[0xd0] = format.int8;
  token[0xd1] = format.int16;
  token[0xd2] = format.int32;
  token[0xd3] = format.int64;

  // fixext 1 -- 0xd4
  // fixext 2 -- 0xd5
  // fixext 4 -- 0xd6
  // fixext 8 -- 0xd7
  // fixext 16 -- 0xd8
  token[0xd4] = fix(1, format.ext);
  token[0xd5] = fix(2, format.ext);
  token[0xd6] = fix(4, format.ext);
  token[0xd7] = fix(8, format.ext);
  token[0xd8] = fix(16, format.ext);

  // str 8 -- 0xd9
  // str 16 -- 0xda
  // str 32 -- 0xdb
  token[0xd9] = flex(format.uint8, format.str);
  token[0xda] = flex(format.uint16, format.str);
  token[0xdb] = flex(format.uint32, format.str);

  // array 16 -- 0xdc
  // array 32 -- 0xdd
  token[0xdc] = flex(format.uint16, format.array);
  token[0xdd] = flex(format.uint32, format.array);

  // map 16 -- 0xde
  // map 32 -- 0xdf
  token[0xde] = flex(format.uint16, format.map);
  token[0xdf] = flex(format.uint32, format.map);

  // negative fixint -- 0xe0 - 0xff
  for (i = 0xe0; i <= 0xff; i++) {
    token[i] = constant(i - 0x100);
  }

  return token;
}

function init_useraw(format) {
  var i;
  var token = init_token(format).slice();

  // raw 8 -- 0xd9
  // raw 16 -- 0xda
  // raw 32 -- 0xdb
  token[0xd9] = token[0xc4];
  token[0xda] = token[0xc5];
  token[0xdb] = token[0xc6];

  // fixraw -- 0xa0 - 0xbf
  for (i = 0xa0; i <= 0xbf; i++) {
    token[i] = fix(i - 0xa0, format.bin);
  }

  return token;
}

function constant(value) {
  return function() {
    return value;
  };
}

function flex(lenFunc, decodeFunc) {
  return function(decoder) {
    var len = lenFunc(decoder);
    return decodeFunc(decoder, len);
  };
}

function fix(len, method) {
  return function(decoder) {
    return method(decoder, len);
  };
}

},{"./read-format":46}],48:[function(require,module,exports){
// write-core.js

var ExtBuffer = require("./ext-buffer").ExtBuffer;
var ExtPacker = require("./ext-packer");
var WriteType = require("./write-type");
var CodecBase = require("./codec-base");

CodecBase.install({
  addExtPacker: addExtPacker,
  getExtPacker: getExtPacker,
  init: init
});

exports.preset = init.call(CodecBase.preset);

function getEncoder(options) {
  var writeType = WriteType.getWriteType(options);
  return encode;

  function encode(encoder, value) {
    var func = writeType[typeof value];
    if (!func) throw new Error("Unsupported type \"" + (typeof value) + "\": " + value);
    func(encoder, value);
  }
}

function init() {
  var options = this.options;
  this.encode = getEncoder(options);

  if (options && options.preset) {
    ExtPacker.setExtPackers(this);
  }

  return this;
}

function addExtPacker(etype, Class, packer) {
  packer = CodecBase.filter(packer);
  var name = Class.name;
  if (name && name !== "Object") {
    var packers = this.extPackers || (this.extPackers = {});
    packers[name] = extPacker;
  } else {
    // fallback for IE
    var list = this.extEncoderList || (this.extEncoderList = []);
    list.unshift([Class, extPacker]);
  }

  function extPacker(value) {
    if (packer) value = packer(value);
    return new ExtBuffer(value, etype);
  }
}

function getExtPacker(value) {
  var packers = this.extPackers || (this.extPackers = {});
  var c = value.constructor;
  var e = c && c.name && packers[c.name];
  if (e) return e;

  // fallback for IE
  var list = this.extEncoderList || (this.extEncoderList = []);
  var len = list.length;
  for (var i = 0; i < len; i++) {
    var pair = list[i];
    if (c === pair[0]) return pair[1];
  }
}

},{"./codec-base":32,"./ext-buffer":40,"./ext-packer":41,"./write-type":50}],49:[function(require,module,exports){
// write-token.js

var ieee754 = require("ieee754");
var Int64Buffer = require("int64-buffer");
var Uint64BE = Int64Buffer.Uint64BE;
var Int64BE = Int64Buffer.Int64BE;

var uint8 = require("./write-uint8").uint8;
var Bufferish = require("./bufferish");
var Buffer = Bufferish.global;
var IS_BUFFER_SHIM = Bufferish.hasBuffer && ("TYPED_ARRAY_SUPPORT" in Buffer);
var NO_TYPED_ARRAY = IS_BUFFER_SHIM && !Buffer.TYPED_ARRAY_SUPPORT;
var Buffer_prototype = Bufferish.hasBuffer && Buffer.prototype || {};

exports.getWriteToken = getWriteToken;

function getWriteToken(options) {
  if (options && options.uint8array) {
    return init_uint8array();
  } else if (NO_TYPED_ARRAY || (Bufferish.hasBuffer && options && options.safe)) {
    return init_safe();
  } else {
    return init_token();
  }
}

function init_uint8array() {
  var token = init_token();

  // float 32 -- 0xca
  // float 64 -- 0xcb
  token[0xca] = writeN(0xca, 4, writeFloatBE);
  token[0xcb] = writeN(0xcb, 8, writeDoubleBE);

  return token;
}

// Node.js and browsers with TypedArray

function init_token() {
  // (immediate values)
  // positive fixint -- 0x00 - 0x7f
  // nil -- 0xc0
  // false -- 0xc2
  // true -- 0xc3
  // negative fixint -- 0xe0 - 0xff
  var token = uint8.slice();

  // bin 8 -- 0xc4
  // bin 16 -- 0xc5
  // bin 32 -- 0xc6
  token[0xc4] = write1(0xc4);
  token[0xc5] = write2(0xc5);
  token[0xc6] = write4(0xc6);

  // ext 8 -- 0xc7
  // ext 16 -- 0xc8
  // ext 32 -- 0xc9
  token[0xc7] = write1(0xc7);
  token[0xc8] = write2(0xc8);
  token[0xc9] = write4(0xc9);

  // float 32 -- 0xca
  // float 64 -- 0xcb
  token[0xca] = writeN(0xca, 4, (Buffer_prototype.writeFloatBE || writeFloatBE), true);
  token[0xcb] = writeN(0xcb, 8, (Buffer_prototype.writeDoubleBE || writeDoubleBE), true);

  // uint 8 -- 0xcc
  // uint 16 -- 0xcd
  // uint 32 -- 0xce
  // uint 64 -- 0xcf
  token[0xcc] = write1(0xcc);
  token[0xcd] = write2(0xcd);
  token[0xce] = write4(0xce);
  token[0xcf] = writeN(0xcf, 8, writeUInt64BE);

  // int 8 -- 0xd0
  // int 16 -- 0xd1
  // int 32 -- 0xd2
  // int 64 -- 0xd3
  token[0xd0] = write1(0xd0);
  token[0xd1] = write2(0xd1);
  token[0xd2] = write4(0xd2);
  token[0xd3] = writeN(0xd3, 8, writeInt64BE);

  // str 8 -- 0xd9
  // str 16 -- 0xda
  // str 32 -- 0xdb
  token[0xd9] = write1(0xd9);
  token[0xda] = write2(0xda);
  token[0xdb] = write4(0xdb);

  // array 16 -- 0xdc
  // array 32 -- 0xdd
  token[0xdc] = write2(0xdc);
  token[0xdd] = write4(0xdd);

  // map 16 -- 0xde
  // map 32 -- 0xdf
  token[0xde] = write2(0xde);
  token[0xdf] = write4(0xdf);

  return token;
}

// safe mode: for old browsers and who needs asserts

function init_safe() {
  // (immediate values)
  // positive fixint -- 0x00 - 0x7f
  // nil -- 0xc0
  // false -- 0xc2
  // true -- 0xc3
  // negative fixint -- 0xe0 - 0xff
  var token = uint8.slice();

  // bin 8 -- 0xc4
  // bin 16 -- 0xc5
  // bin 32 -- 0xc6
  token[0xc4] = writeN(0xc4, 1, Buffer.prototype.writeUInt8);
  token[0xc5] = writeN(0xc5, 2, Buffer.prototype.writeUInt16BE);
  token[0xc6] = writeN(0xc6, 4, Buffer.prototype.writeUInt32BE);

  // ext 8 -- 0xc7
  // ext 16 -- 0xc8
  // ext 32 -- 0xc9
  token[0xc7] = writeN(0xc7, 1, Buffer.prototype.writeUInt8);
  token[0xc8] = writeN(0xc8, 2, Buffer.prototype.writeUInt16BE);
  token[0xc9] = writeN(0xc9, 4, Buffer.prototype.writeUInt32BE);

  // float 32 -- 0xca
  // float 64 -- 0xcb
  token[0xca] = writeN(0xca, 4, Buffer.prototype.writeFloatBE);
  token[0xcb] = writeN(0xcb, 8, Buffer.prototype.writeDoubleBE);

  // uint 8 -- 0xcc
  // uint 16 -- 0xcd
  // uint 32 -- 0xce
  // uint 64 -- 0xcf
  token[0xcc] = writeN(0xcc, 1, Buffer.prototype.writeUInt8);
  token[0xcd] = writeN(0xcd, 2, Buffer.prototype.writeUInt16BE);
  token[0xce] = writeN(0xce, 4, Buffer.prototype.writeUInt32BE);
  token[0xcf] = writeN(0xcf, 8, writeUInt64BE);

  // int 8 -- 0xd0
  // int 16 -- 0xd1
  // int 32 -- 0xd2
  // int 64 -- 0xd3
  token[0xd0] = writeN(0xd0, 1, Buffer.prototype.writeInt8);
  token[0xd1] = writeN(0xd1, 2, Buffer.prototype.writeInt16BE);
  token[0xd2] = writeN(0xd2, 4, Buffer.prototype.writeInt32BE);
  token[0xd3] = writeN(0xd3, 8, writeInt64BE);

  // str 8 -- 0xd9
  // str 16 -- 0xda
  // str 32 -- 0xdb
  token[0xd9] = writeN(0xd9, 1, Buffer.prototype.writeUInt8);
  token[0xda] = writeN(0xda, 2, Buffer.prototype.writeUInt16BE);
  token[0xdb] = writeN(0xdb, 4, Buffer.prototype.writeUInt32BE);

  // array 16 -- 0xdc
  // array 32 -- 0xdd
  token[0xdc] = writeN(0xdc, 2, Buffer.prototype.writeUInt16BE);
  token[0xdd] = writeN(0xdd, 4, Buffer.prototype.writeUInt32BE);

  // map 16 -- 0xde
  // map 32 -- 0xdf
  token[0xde] = writeN(0xde, 2, Buffer.prototype.writeUInt16BE);
  token[0xdf] = writeN(0xdf, 4, Buffer.prototype.writeUInt32BE);

  return token;
}

function write1(type) {
  return function(encoder, value) {
    var offset = encoder.reserve(2);
    var buffer = encoder.buffer;
    buffer[offset++] = type;
    buffer[offset] = value;
  };
}

function write2(type) {
  return function(encoder, value) {
    var offset = encoder.reserve(3);
    var buffer = encoder.buffer;
    buffer[offset++] = type;
    buffer[offset++] = value >>> 8;
    buffer[offset] = value;
  };
}

function write4(type) {
  return function(encoder, value) {
    var offset = encoder.reserve(5);
    var buffer = encoder.buffer;
    buffer[offset++] = type;
    buffer[offset++] = value >>> 24;
    buffer[offset++] = value >>> 16;
    buffer[offset++] = value >>> 8;
    buffer[offset] = value;
  };
}

function writeN(type, len, method, noAssert) {
  return function(encoder, value) {
    var offset = encoder.reserve(len + 1);
    encoder.buffer[offset++] = type;
    method.call(encoder.buffer, value, offset, noAssert);
  };
}

function writeUInt64BE(value, offset) {
  new Uint64BE(this, offset, value);
}

function writeInt64BE(value, offset) {
  new Int64BE(this, offset, value);
}

function writeFloatBE(value, offset) {
  ieee754.write(this, value, offset, false, 23, 4);
}

function writeDoubleBE(value, offset) {
  ieee754.write(this, value, offset, false, 52, 8);
}

},{"./bufferish":31,"./write-uint8":51,"ieee754":21,"int64-buffer":22}],50:[function(require,module,exports){
// write-type.js

var IS_ARRAY = require("isarray");
var Int64Buffer = require("int64-buffer");
var Uint64BE = Int64Buffer.Uint64BE;
var Int64BE = Int64Buffer.Int64BE;

var Bufferish = require("./bufferish");
var BufferProto = require("./bufferish-proto");
var WriteToken = require("./write-token");
var uint8 = require("./write-uint8").uint8;
var ExtBuffer = require("./ext-buffer").ExtBuffer;

var HAS_UINT8ARRAY = ("undefined" !== typeof Uint8Array);
var HAS_MAP = ("undefined" !== typeof Map);

var extmap = [];
extmap[1] = 0xd4;
extmap[2] = 0xd5;
extmap[4] = 0xd6;
extmap[8] = 0xd7;
extmap[16] = 0xd8;

exports.getWriteType = getWriteType;

function getWriteType(options) {
  var token = WriteToken.getWriteToken(options);
  var useraw = options && options.useraw;
  var binarraybuffer = HAS_UINT8ARRAY && options && options.binarraybuffer;
  var isBuffer = binarraybuffer ? Bufferish.isArrayBuffer : Bufferish.isBuffer;
  var bin = binarraybuffer ? bin_arraybuffer : bin_buffer;
  var usemap = HAS_MAP && options && options.usemap;
  var map = usemap ? map_to_map : obj_to_map;

  var writeType = {
    "boolean": bool,
    "function": nil,
    "number": number,
    "object": (useraw ? object_raw : object),
    "string": _string(useraw ? raw_head_size : str_head_size),
    "symbol": nil,
    "undefined": nil
  };

  return writeType;

  // false -- 0xc2
  // true -- 0xc3
  function bool(encoder, value) {
    var type = value ? 0xc3 : 0xc2;
    token[type](encoder, value);
  }

  function number(encoder, value) {
    var ivalue = value | 0;
    var type;
    if (value !== ivalue) {
      // float 64 -- 0xcb
      type = 0xcb;
      token[type](encoder, value);
      return;
    } else if (-0x20 <= ivalue && ivalue <= 0x7F) {
      // positive fixint -- 0x00 - 0x7f
      // negative fixint -- 0xe0 - 0xff
      type = ivalue & 0xFF;
    } else if (0 <= ivalue) {
      // uint 8 -- 0xcc
      // uint 16 -- 0xcd
      // uint 32 -- 0xce
      type = (ivalue <= 0xFF) ? 0xcc : (ivalue <= 0xFFFF) ? 0xcd : 0xce;
    } else {
      // int 8 -- 0xd0
      // int 16 -- 0xd1
      // int 32 -- 0xd2
      type = (-0x80 <= ivalue) ? 0xd0 : (-0x8000 <= ivalue) ? 0xd1 : 0xd2;
    }
    token[type](encoder, ivalue);
  }

  // uint 64 -- 0xcf
  function uint64(encoder, value) {
    var type = 0xcf;
    token[type](encoder, value.toArray());
  }

  // int 64 -- 0xd3
  function int64(encoder, value) {
    var type = 0xd3;
    token[type](encoder, value.toArray());
  }

  // str 8 -- 0xd9
  // str 16 -- 0xda
  // str 32 -- 0xdb
  // fixstr -- 0xa0 - 0xbf
  function str_head_size(length) {
    return (length < 32) ? 1 : (length <= 0xFF) ? 2 : (length <= 0xFFFF) ? 3 : 5;
  }

  // raw 16 -- 0xda
  // raw 32 -- 0xdb
  // fixraw -- 0xa0 - 0xbf
  function raw_head_size(length) {
    return (length < 32) ? 1 : (length <= 0xFFFF) ? 3 : 5;
  }

  function _string(head_size) {
    return string;

    function string(encoder, value) {
      // prepare buffer
      var length = value.length;
      var maxsize = 5 + length * 3;
      encoder.offset = encoder.reserve(maxsize);
      var buffer = encoder.buffer;

      // expected header size
      var expected = head_size(length);

      // expected start point
      var start = encoder.offset + expected;

      // write string
      length = BufferProto.write.call(buffer, value, start);

      // actual header size
      var actual = head_size(length);

      // move content when needed
      if (expected !== actual) {
        var targetStart = start + actual - expected;
        var end = start + length;
        BufferProto.copy.call(buffer, buffer, targetStart, start, end);
      }

      // write header
      var type = (actual === 1) ? (0xa0 + length) : (actual <= 3) ? (0xd7 + actual) : 0xdb;
      token[type](encoder, length);

      // move cursor
      encoder.offset += length;
    }
  }

  function object(encoder, value) {
    // null
    if (value === null) return nil(encoder, value);

    // Buffer
    if (isBuffer(value)) return bin(encoder, value);

    // Array
    if (IS_ARRAY(value)) return array(encoder, value);

    // int64-buffer objects
    if (Uint64BE.isUint64BE(value)) return uint64(encoder, value);
    if (Int64BE.isInt64BE(value)) return int64(encoder, value);

    // ext formats
    var packer = encoder.codec.getExtPacker(value);
    if (packer) value = packer(value);
    if (value instanceof ExtBuffer) return ext(encoder, value);

    // plain old Objects or Map
    map(encoder, value);
  }

  function object_raw(encoder, value) {
    // Buffer
    if (isBuffer(value)) return raw(encoder, value);

    // others
    object(encoder, value);
  }

  // nil -- 0xc0
  function nil(encoder, value) {
    var type = 0xc0;
    token[type](encoder, value);
  }

  // fixarray -- 0x90 - 0x9f
  // array 16 -- 0xdc
  // array 32 -- 0xdd
  function array(encoder, value) {
    var length = value.length;
    var type = (length < 16) ? (0x90 + length) : (length <= 0xFFFF) ? 0xdc : 0xdd;
    token[type](encoder, length);

    var encode = encoder.codec.encode;
    for (var i = 0; i < length; i++) {
      encode(encoder, value[i]);
    }
  }

  // bin 8 -- 0xc4
  // bin 16 -- 0xc5
  // bin 32 -- 0xc6
  function bin_buffer(encoder, value) {
    var length = value.length;
    var type = (length < 0xFF) ? 0xc4 : (length <= 0xFFFF) ? 0xc5 : 0xc6;
    token[type](encoder, length);
    encoder.send(value);
  }

  function bin_arraybuffer(encoder, value) {
    bin_buffer(encoder, new Uint8Array(value));
  }

  // fixext 1 -- 0xd4
  // fixext 2 -- 0xd5
  // fixext 4 -- 0xd6
  // fixext 8 -- 0xd7
  // fixext 16 -- 0xd8
  // ext 8 -- 0xc7
  // ext 16 -- 0xc8
  // ext 32 -- 0xc9
  function ext(encoder, value) {
    var buffer = value.buffer;
    var length = buffer.length;
    var type = extmap[length] || ((length < 0xFF) ? 0xc7 : (length <= 0xFFFF) ? 0xc8 : 0xc9);
    token[type](encoder, length);
    uint8[value.type](encoder);
    encoder.send(buffer);
  }

  // fixmap -- 0x80 - 0x8f
  // map 16 -- 0xde
  // map 32 -- 0xdf
  function obj_to_map(encoder, value) {
    var keys = Object.keys(value);
    var length = keys.length;
    var type = (length < 16) ? (0x80 + length) : (length <= 0xFFFF) ? 0xde : 0xdf;
    token[type](encoder, length);

    var encode = encoder.codec.encode;
    keys.forEach(function(key) {
      encode(encoder, key);
      encode(encoder, value[key]);
    });
  }

  // fixmap -- 0x80 - 0x8f
  // map 16 -- 0xde
  // map 32 -- 0xdf
  function map_to_map(encoder, value) {
    if (!(value instanceof Map)) return obj_to_map(encoder, value);

    var length = value.size;
    var type = (length < 16) ? (0x80 + length) : (length <= 0xFFFF) ? 0xde : 0xdf;
    token[type](encoder, length);

    var encode = encoder.codec.encode;
    value.forEach(function(val, key, m) {
      encode(encoder, key);
      encode(encoder, val);
    });
  }

  // raw 16 -- 0xda
  // raw 32 -- 0xdb
  // fixraw -- 0xa0 - 0xbf
  function raw(encoder, value) {
    var length = value.length;
    var type = (length < 32) ? (0xa0 + length) : (length <= 0xFFFF) ? 0xda : 0xdb;
    token[type](encoder, length);
    encoder.send(value);
  }
}

},{"./bufferish":31,"./bufferish-proto":29,"./ext-buffer":40,"./write-token":49,"./write-uint8":51,"int64-buffer":22,"isarray":23}],51:[function(require,module,exports){
// write-unit8.js

var constant = exports.uint8 = new Array(256);

for (var i = 0x00; i <= 0xFF; i++) {
  constant[i] = write0(i);
}

function write0(type) {
  return function(encoder) {
    var offset = encoder.reserve(1);
    encoder.buffer[offset] = type;
  };
}

},{}],52:[function(require,module,exports){
// inner Modules
var util = require('../../modules/public/util.js');
var User = require('../../modules/client/CUser.js');
var CManager = require('../../modules/client/CManager.js');
var gameConfig = require('../../modules/public/gameConfig.json');
// var resource = require('../../modules/public/resource.json');
var objectAssign = require('../../modules/public/objectAssign.js');
var csvJson = require('../../modules/public/csvjson.js');
var dataJson = require('../../modules/public/data.json');
var WebSocketClient = require('../../modules/client/WebSocketClient.js');

var csvJsonOption = {delimiter : ',', quote : '"'};
var userStatTable = csvJson.toObject(dataJson.userStatData, csvJsonOption);
var skillTable = csvJson.toObject(dataJson.skillData, csvJsonOption);
var buffGroupTable = csvJson.toObject(dataJson.buffGroupData, csvJsonOption);
var resourceTable = csvJson.toObject(dataJson.resourceData, csvJsonOption);
var iconResourceTable = csvJson.toObject(dataJson.iconResourceData, csvJsonOption);
var obstacleTable = csvJson.toObject(dataJson.obstacleData, csvJsonOption);
var mobTable = csvJson.toObject(dataJson.mobData, csvJsonOption);
var effectGroupTable = csvJson.toObject(dataJson.effectGroupData, csvJsonOption);
// var objBuffTable = csvJson.toObject(dataJson.objBuffData, csvJsonOption);

var socket;

// document elements
// var startScene, gameScene, standingScene;
// var startButton;

var CUIManager = require('../../modules/client/CUIManager.js');
var UIManager;

var canvas, ctx, scaleFactor;

// const var
var radianFactor = Math.PI/180;
var fps = 1000/gameConfig.FPS;
var INTERVAL_TIMER = 1000/gameConfig.INTERVAL;

// game var
var Manager;

// resource var
var loadedResourcesCount = 0;
var resourceObject, resourceCharacter, resourceUI, resourceSkillEffect, resourceEnvironment;
var isLoadResources = false, isUISettingComplete = false, loadingStartTime = Date.now(), loadingTextChangeTime = Date.now();
var isLoadServerList = false, isServerConditionGood = false, isConnectSocket = false;
// var completeTwitter = false, completeFacebook = false;

var userHandImgData = new Array(5);
var userCastingTimeHandler = false;

var obstacleTreeInsideImgData, collisionClearTime = Date.now();
var objGoldImgData, objJewelImgData, objBoxImgData, objSkillFireImgData, objSkillFrostImgData, objSkillArcaneImgData;
var castFireImgData, castFrostImgData, castArcaneImgData;
var projectileFireImgData, projectileFrostImgData, projectileArcaneImgData;
var skillFireImgData, skillFrostImgData, skillArcaneImgData;
var rank1ImgData, rank2ImgData, rank3ImgData;
var projectileSkillArrowImgData;
var hittedChest = [];
var portalImgData = new Array(5), portalImgIndex = 0, isUpPortalImgIndex = true,
    portalImgChangeTime = Date.now(), portalRotateDegree = 0, portalCacheCanvas;

// var conditionFreezeImgData, conditionChillImgData, conditionImmortalImgData, conditionSilenceImgData,
//     conditionIgnite1ImgData, conditionIgnite2ImgData, conditionIgnite3ImgData, conditionIgnite4ImgData, conditionIgnite5ImgData;
// var userImage, userHand;
// var grid;

// game state var
var gameState = gameConfig.GAME_STATE_LOAD;
var animLoopHandle = null;
var gameSetupFunc = null;
var gameUpdateFunc = null;
var isChattingOn = false, isOnField = false;
var continueMove = false, coninueMoveEventTime = Date.now();

var latency = 0, timeDiff = 0;
var drawInterval = false;
var userDataUpdateInterval = false;
var userDataLastUpdateTime = Date.now();
var userLastActionTime = Date.now();
var userPingCheckTime = Date.now();
var drawUITimer = Date.now();
var frameCounter = null;

// var restartTimeout = false;
var errorTimeout = false;
var isFirstStart = true;
var isSyncID = false, syncCheckInterval = false,
    syncCheckTimer = 1000;
var killCount = 0, totalKillCount = 0;

//draw skills range, explosionRadius.
var drawMode = gameConfig.DRAW_MODE_NORMAL;
//use when draw mode skill.
var mousePoint = {x : 0, y : 0};
var currentSkillData = null;

var characterType = 1;

var currentLevel = 1;
var pyroLevel = 1, frosterLevel = 1, mysterLevel = 1;
var pyroBaseSkill = gameConfig.SKILL_INDEX_PYRO_BASE, pyroInherentPassiveSkill = gameConfig.SKILL_INDEX_PYRO_PASSIVE, pyroEquipSkills = new Array(4),
    frosterBaseSkill = gameConfig.SKILL_INDEX_FROST_BASE, frosterInherentPassiveSkill = gameConfig.SKILL_INDEX_FROST_PASSIVE, frosterEquipSkills = new Array(4),
    mysterBaseSkill = gameConfig.SKILL_INDEX_ARCANE_BASE, mysterInherentPassiveSkill = gameConfig.SKILL_INDEX_ARCANE_PASSIVE, mysterEquipSkills = new Array(4);

var userName = "";
var baseSkill = 0;
var baseSkillData = null;
var inherentPassiveSkill = 0;
var inherentPassiveSkillData = null;
var equipSkills = new Array(4);
var equipSkillDatas = new Array(4);
var possessSkills = [];

var killUser = null;
var targetJewel, targetGold, targetLevel, targetExp;

var syncCount = 0;
// var loseResource = {gold : 0, jewel : 0};
// var lostSkills = [];
// var isLostSkill = false, isInherentSomething = false;

var rankers = [];
var keySettings = {
  "BindingE" : 69,
  "BindingSpace" : 32,
  "BindingA" : 65,
  "Binding1" : 49,
  "Binding2" : 50,
  "Binding3" : 51,
  "Binding4" : 52,
  "BindingS" : 83,
  "BindingG" : 71,
  "BindingHome" : 36,
  "BindingEnter" : 13,
  "BindingEsc" : 27
};
//state changer
function changeState(newState){
  // clearInterval(drawInterval);
  if(animLoopHandle){
    window.cancelAnimFrame(animLoopHandle);
  }
  clearInterval(userDataUpdateInterval);
  // drawInterval = false;
  animLoopHandle = null;
  userDataUpdateInterval = false;

  switch (newState) {
    case gameConfig.GAME_STATE_LOAD:
      gameState = newState;
      gameSetupFunc = stateFuncLoad;
      gameUpdateFunc = stateFuncCheckLoad;
      break;
    case gameConfig.GAME_STATE_START_SCENE:
      gameState = newState;
      gameSetupFunc = null;
      gameUpdateFunc = stateFuncStandby;
      break;
    case gameConfig.GAME_STATE_GAME_START:
      gameState = newState;
      gameSetupFunc = stateFuncStart;
      gameUpdateFunc = stateFuncCheckServer;
      break;
    case gameConfig.GAME_STATE_GAME_ON:
      gameState = newState;
      gameSetupFunc = stateFuncGameSetup;
      gameUpdateFunc = stateFuncGame;
      break;
    case gameConfig.GAME_STATE_END:
      gameState = newState;
      gameSetupFunc = stateFuncEnd;
      gameUpdateFunc = stateFuncGame;
      break;
    case gameConfig.GAME_STATE_RESTART_SCENE:
      gameState = newState;
      gameSetupFunc = null;
      gameUpdateFunc = stateFuncStandbyRestart;
      break;
    case gameConfig.GAME_STATE_RESTART:
      gameState = newState;
      gameSetupFunc = stateFuncRestart;
      gameUpdateFunc = null;
      break;
  }
  update();
};

window.requestAnimFrame = (function() {
    return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            window.msRequestAnimationFrame     ||
            function( callback ) {
                window.setTimeout(callback, 1000 / 60);
            };
})();

window.cancelAnimFrame = (function(handle) {
    return  window.cancelAnimationFrame     ||
            window.mozCancelAnimationFrame;
})();

function animloop() {
    animLoopHandle = window.requestAnimFrame(animloop);
    gameUpdateFunc();
}

function update(){
  // if(gameSetupFunc === null && gameUpdateFunc !== null){
  //   drawInterval = setInterval(gameUpdateFunc,fps);
  // }else if(gameSetupFunc !==null && gameUpdateFunc === null){
  //   gameSetupFunc();
  // }
  if(gameUpdateFunc){
    animloop();
    // drawInterval = setInterval(gameUpdateFunc, fps);
  }
  if(gameSetupFunc){
    gameSetupFunc();
  }
};

//load resource, base setting
function stateFuncLoad(){
  setBaseSetting();
  setCanvasSize();
  window.oncontextmenu = function(){
    return false;
  };
  window.onresize = function(){
    setCanvasSize();
  };
  window.onblur = function(){
    if(gameState === gameConfig.GAME_STATE_GAME_ON){
      Manager.stopUser();
    }
  };
  window.onbeforeunload = function() {
    if (socket) {
      socket.close(1000);
    }
    // socket.instance.onclose();
    // return 'Are you sure?';
  };
  // UIManager.setServerList();

  // UIManager.setSkillChangeBtn();
  // loadResources();
  // UIManager.setSkillIconResource(resourceSkillIcon);
};
function stateFuncCheckLoad(){
  if(isLoadResources && isUISettingComplete && Date.now() - loadingStartTime >= gameConfig.MINIMUM_LOADING_TIME
     && isLoadServerList){
    UIManager.startSceneLoadingComplete();
    changeState(gameConfig.GAME_STATE_START_SCENE);
  }else if(Date.now() - loadingTextChangeTime >= gameConfig.CHANGE_LOADING_TEXT_TIME){
    loadingTextChangeTime = Date.now();
    UIManager.changeLoadingText();
  }
};
//when all resource loaded. just draw start scene
function stateFuncStandby(){
  drawStartScene();
};
//if start button clicked, setting game before start game
//setup socket here!!! now changestate in socket response functions
function stateFuncStart(){
  // UIManager.setFeedbackBtn();
  UIManager.disableStartButton();

  var url = UIManager.getSelectedServer();
  // UIManager.disableStartScene();
  if(url){
    UIManager.checkServerCondition(url);
  }
};
function stateFuncCheckServer(){
  if(!isConnectSocket){
    if(isServerConditionGood){
      isConnectSocket = true;
      var url = UIManager.getSelectedServer();
      if(url){
        setupSocket(url);
        userName = UIManager.getStartUserName();
        // var twitter = util.getCookie(document.cookie, 'twitter');
        // var facebook = util.getCookie(document.cookie, 'facebook');
        // socket.onopen = function(){
        //   socket.emit('reqStartGame', characterType, userName, twitter, facebook);
        //   userPingCheckTime = Date.now();
        //   socket.emit('firePing', userPingCheckTime);
        // }
      }else{
        alert("Select available server.");
        isConnectSocket = false;
        UIManager.enableStartButton();
        changeState(gameConfig.GAME_STATE_START_SCENE);
      }
    }else{
      if(isConnectSocket){
        isConnectSocket = false;
        UIManager.enableStartButton();
        changeState(gameConfig.GAME_STATE_START_SCENE);
      }
    }
  }
};
//game play on
function stateFuncGameSetup(){
  UIManager.disableStartScene();
  UIManager.enableFieldUIs();
  // UIManager.disableRestartScene();
};
function stateFuncGame(){
  frameCounter.countFrames();
  drawGame();
};
//show end message and restart button
function stateFuncEnd(){
  //should init variables
  // var toLevel = 1;
  // switch (characterType) {
  //   case gameConfig.CHAR_TYPE_FIRE:
  //     toLevel = pyroLevel;
  //     break;
  //   case gameConfig.CHAR_TYPE_FROST:
  //     toLevel = frosterLevel;
  //     break;
  //   case gameConfig.CHAR_TYPE_ARCANE:
  //     toLevel = mysterLevel;
  //     break;
  //   default:
  // }
  continueMove = false;
  canvasDisableEvent();
  documentDisableEvent();

  if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
    changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
  };
  UIManager.closePopUpSkillChange();
  // UIManager.updateSkills(changeSkills);

  updateCharTypeSkill(characterType);
  var curExp = Manager.getUserExp();
  UIManager.playDeadScene(gameConfig.userID, killUser, currentLevel, targetLevel, curExp, targetExp, targetJewel, targetGold); // , toLevel, loseResource, isLostSkill, currentLevel, isInherentSomething);
  currentLevel = targetLevel;
  updateCharTypeLevel();

  // change this!!!!
  // restartTimeout = setTimeout(function(){
    // restartTimeout = false;
  // }, gameConfig.DEAD_SCENE_PLAY_TIME);
};
function stateFuncStandbyRestart(){
  drawRestartScene();
}
function stateFuncRestart(){
  UIManager.disableStandingScene();
  userName = UIManager.getStandingUserName();
  socket.emit(gameConfig.MTYPE_REQ_RESTART_GAME, userName, characterType, equipSkills);
};
//functions
function setBaseSetting(){
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');

  UIManager = new CUIManager();
  if (_u) {
    applyAccount();
  }
  if (!_a) {
    _onU = function(u, d, a) {
      if (d) {
        alert('That account was already registered.');
      } else if (u) {
        _u = u;
        _a = a;
        applyAccount();
        UIManager.startSceneLoginComplete();
      }
    }
  }
  UIManager.updateKillCount = function(kill, totalKill){
    killCount = kill;
    totalKillCount = totalKill;
  };
  UIManager.onSetRankers = function(rankList){
    rankers = rankList;
  };
  UIManager.onLoadCompleteServerList = function(){
    isLoadServerList = true;
  };
  UIManager.serverConditionOn = function(){
    isServerConditionGood = true;
  };
  UIManager.serverConditionOff = function(){
    isServerConditionGood = false;
    UIManager.enableStartButton();
    changeState(gameConfig.GAME_STATE_START_SCENE);
  }
  UIManager.onStartBtnClick = function(charType, clickButton){
    userLastActionTime = Date.now();
    characterType = charType;
    if(clickButton === gameConfig.START_BUTTON){
      changeState(gameConfig.GAME_STATE_GAME_START);
    }else if(clickButton === gameConfig.RESTART_BUTTON){
      changeState(gameConfig.GAME_STATE_RESTART);
    }
  };
  UIManager.onSkillUpgrade = function(skillIndex){
    userLastActionTime = Date.now();
    socket.emit(gameConfig.MTYPE_UPGRADE_SKILL, skillIndex);
  };
  UIManager.onExchangeSkill = function(charType){
    updateCharTypeSkill(charType);
    if(Manager.getUserCurrentState(gameConfig.userID) === gameConfig.OBJECT_STATE_CAST){
      var skillIndex = Manager.getUserCurrentSkillIndex(gameConfig.userID)
      if(equipSkills.indexOf(skillIndex) === -1){
        Manager.stopUser();
      }
    }
  };
  UIManager.onExchangePassive = function(beforeBuffGID, afterBuffGID){
    socket.emit(gameConfig.MTYPE_EXCHANGE_PASSIVE, beforeBuffGID, afterBuffGID);
  };
  UIManager.onEquipPassive = function(buffGroupIndex){
    socket.emit(gameConfig.MTYPE_EQUIP_PASSIVE, buffGroupIndex);
  };
  UIManager.onUnequipPassive = function(buffGroupIndex){
    socket.emit(gameConfig.MTYPE_UNEQUIP_PASSIVE, buffGroupIndex);
  };
  UIManager.onSkillIconClick = function(skillSlot){
    userLastActionTime = Date.now();
    if(skillSlot === gameConfig.SKILL_BASIC_INDEX){
      // if(UIManager.checkCooltime(gameConfig.SKILL_BASIC_INDEX)){
      var skillData = objectAssign({}, baseSkillData);
      // }
    }else if(skillSlot === gameConfig.SKILL_EQUIP1_INDEX){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP1_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[0]);
      // }
    }else if(skillSlot === gameConfig.SKILL_EQUIP2_INDEX){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP2_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[1]);
      // }
    }else if(skillSlot === gameConfig.SKILL_EQUIP3_INDEX){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP3_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[2]);
      // }
    }else if(skillSlot === gameConfig.SKILL_EQUIP4_INDEX){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP4_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[3]);
      // }
    }
    checkSkillConditionAndUse(skillData);
  };
  UIManager.onSelectSkillCancelBtnClick = function(){
    changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
  };
  UIManager.onSelectCharIcon = function(type){
    userLastActionTime = Date.now();
    characterType = type;
    var level = 1;
    switch (type) {
      case gameConfig.CHAR_TYPE_FIRE:
        level = pyroLevel;
        baseSkill = pyroBaseSkill;
        for(var i=0; i<4; i++){
          equipSkills[i] = pyroEquipSkills[i]
        }
        inherentPassiveSkill = pyroInherentPassiveSkill;
        break;
      case gameConfig.CHAR_TYPE_FROST:
        level = frosterLevel;
        baseSkill = frosterBaseSkill;
        for(var i=0; i<4; i++){
          equipSkills[i] = frosterEquipSkills[i]
        }
        inherentPassiveSkill = frosterInherentPassiveSkill;
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        level = mysterLevel;
        baseSkill = mysterBaseSkill;
        for(var i=0; i<4; i++){
          equipSkills[i] = mysterEquipSkills[i]
        }
        inherentPassiveSkill = mysterInherentPassiveSkill;
        break;
      default:
    }
    baseSkillData = objectAssign({}, util.findData(skillTable, 'index', baseSkill));
    inherentPassiveSkillData = objectAssign({}, util.findData(skillTable, 'index', inherentPassiveSkill));
    for(var i=0; i<4; i++){
      if(equipSkills[i]){
        equipSkillDatas[i] = objectAssign({}, util.findData(skillTable, 'index', equipSkills[i]));
      }else{
        equipSkillDatas[i] = undefined;
      }
    };
    UIManager.syncSkills(baseSkill, baseSkillData, equipSkills, equipSkillDatas, possessSkills, inherentPassiveSkill, inherentPassiveSkillData);
    UIManager.setPopUpSkillChange(true);
    UIManager.updateCharInfoSelectedPanel(type, level);
  };
  UIManager.onPopUpSkillChangeClick = function(){
    userLastActionTime = Date.now();
  };

  UIManager.onUpgradeCharSkills = function(bSkillData, bPassiveSkillData) {
    baseSkill = bSkillData.index;
    baseSkillData = bSkillData;
    inherentPassiveSkill = bPassiveSkillData.index;
    inherentPassiveSkillData = bPassiveSkillData;
    updateCharTypeSkill(characterType);
  };
  UIManager.onDeadSceneConfirmClick = function() {
    UIManager.closePopUpSkillChange();
    UIManager.disableDeadScene();
    UIManager.clearCooltime();

    UIManager.initStandingScene(characterType, userName);
    UIManager.setPopUpSkillChange(true);

    changeState(gameConfig.GAME_STATE_RESTART_SCENE);
  };
  // UIManager.onSocialBtnClick = function(twitter, facebook){
  //   var beforeTwitter = completeTwitter;
  //   var beforeFacebook = completeFacebook;
  //   if(twitter){
  //     completeTwitter = true;
  //     UIManager.completeTwitter();
  //   }
  //   if(facebook){
  //     completeFacebook = true;
  //     UIManager.completeFacebook();
  //   }
  //   if(isConnectSocket && socket){
  //     if(beforeTwitter !== completeTwitter){
  //       socket.emit('completeTwitter');
  //     }
  //     if(beforeFacebook !== completeFacebook){
  //       socket.emit('completeFacebook');
  //     }
  //   }
  // };

  document.body.onmousedown = function(e){
    if(e.button === 2){
      if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
        changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
      }
    }
  };

  // inner Modules
  util = require('../../modules/public/util.js');
  User = require('../../modules/client/CUser.js');
  CManager = require('../../modules/client/CManager.js');
  gameConfig = require('../../modules/public/gameConfig.json');

  Manager = new CManager(gameConfig);
  Manager.onSkillFire = onSkillFireHandler;
  Manager.onProjectileSkillFire = onProjectileSkillFireHandler;
  Manager.onUserLevelUp = function(level){
    currentLevel = level;
  };
  Manager.onNeedToGetObjBuffResource = function(objData){
    objData.resourceData = objectAssign({}, util.findData(resourceTable, 'index', objData.rID));
  };
  // Manager.onCancelCasting = onCancelCastingHandler;

  frameCounter = new FrameCounter();

  resourceObject = new Image()
  resourceCharacter = new Image();
  resourceUI = new Image();
  resourceSkillEffect = new Image();
  resourceEnvironment = new Image();
  // resourceSkillIcon = new Image();

  userHandImgData[0] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_USER_HAND_1));
  userHandImgData[1] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_USER_HAND_2));
  userHandImgData[2] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_USER_HAND_3));
  userHandImgData[3] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_USER_HAND_4));
  userHandImgData[4] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_USER_HAND_5));

  portalImgData[0] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_PORTAL_1));
  portalImgData[1] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_PORTAL_2));
  portalImgData[2] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_PORTAL_3));
  portalImgData[3] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_PORTAL_4));
  portalImgData[4] = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_PORTAL_5));

  obstacleTreeInsideImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_OBSTACLE_TREE_INSIDE));

  objGoldImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_OBJ_GOLD));
  objJewelImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_OBJ_JEWEL));
  objBoxImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_OBJ_BOX));
  objSkillFireImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_OBJ_SKILL_FIRE));
  objSkillFrostImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_OBJ_SKILL_FROST));
  objSkillArcaneImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_OBJ_SKILL_ARCANE));

  castFireImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CASTING_FIRE));
  castFrostImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CASTING_FROST));
  castArcaneImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CASTING_ARCANE));

  projectileFireImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_PROJECTILE_FIRE));
  projectileFrostImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_PROJECTILE_FROST));
  projectileArcaneImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_PROJECTILE_ARCANE));

  skillFireImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_SKILL_EFFECT_FIRE));
  skillFrostImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_SKILL_EFFECT_FROST));
  skillArcaneImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_SKILL_EFFECT_ARCANE));

  rank1ImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_RANK_1));
  rank2ImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_RANK_2));
  rank3ImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_RANK_3));

  projectileSkillArrowImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_PROJECTILE_SKILL_ARROW));
  // conditionFreezeImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_FREEZE));
  // conditionChillImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_CHILL));
  // conditionImmortalImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_IMMORTAL));
  // conditionSilenceImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_SILENCE));
  // conditionIgnite1ImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_IGNITE1));
  // conditionIgnite2ImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_IGNITE2));
  // conditionIgnite3ImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_IGNITE3));
  // conditionIgnite4ImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_IGNITE4));
  // conditionIgnite5ImgData = objectAssign({}, util.findData(resourceTable, 'index', gameConfig.RESOURCE_INDEX_CONDITION_IGNITE5));
  // grid = new Image();
  // grid.src = resources.GRID_SRC;
  // get keySetting cookie
  var cookieKeySettings = util.getCookie(document.cookie, 'keySettings');
  if(cookieKeySettings){
    keySettings = JSON.parse(cookieKeySettings);
    UIManager.updateKeySettings(keySettings);
  }

  loadResources();
  UIManager.setSkillIconResource(resourceUI);
  UIManager.initStartScene();
  UIManager.initHUD(keySettings);
  UIManager.initPopUpSkillChanger();
  UIManager.setSkillChangeBtn();

  // var twitter = util.getCookie(document.cookie, 'twitter');
  // var facebook = util.getCookie(document.cookie, 'facebook');
  // if(twitter){
  //   completeTwitter = true;
  //   UIManager.completeTwitter();
  // }
  // if(facebook){
  //   completeFacebook = true;
  //   UIManager.completeFacebook();
  // }
  portalCacheCanvas = document.createElement('canvas');
  var cacheCtx = portalCacheCanvas.getContext('2d');
  portalCacheCanvas.width = 200;
  portalCacheCanvas.height = 100;
  cacheCtx.beginPath();
  cacheCtx.textAlign = 'center';
  cacheCtx.fillStyle = 'white';
  cacheCtx.font = 'bold 20px Arial';
  cacheCtx.fillText('To The Field!', 100, 50);
  cacheCtx.closePath();

  isUISettingComplete = true;
};
function loadResources(){
  resourceObject.src = gameConfig.RESOURCE_SRC_OBJECT;
  resourceObject.onload = loadResourceHandler;
  resourceCharacter.src = gameConfig.RESOURCE_SRC_CHARACTER;
  resourceCharacter.onload = loadResourceHandler;
  resourceSkillEffect.src = gameConfig.RESOURCE_SRC_SKILL_EFFECT;
  resourceSkillEffect.onload = loadResourceHandler;
  resourceEnvironment.src = gameConfig.RESOURCE_SRC_ENVIRONMENT;
  resourceEnvironment.onload = loadResourceHandler;
  resourceUI.src = gameConfig.RESOURCE_SRC_UI;
  resourceUI.onload = loadResourceHandler;
};
function loadResourceHandler(){
  loadedResourcesCount++;
  if(loadedResourcesCount >= gameConfig.RESOURCES_COUNT){
    isLoadResources = true;
    UIManager.setServerList();
    // changeState(gameConfig.GAME_STATE_START_SCENE);
  }
};
function onSkillFireHandler(rawSkillData, syncFireTime){
  var skillData = Manager.processSkillData(rawSkillData);
  skillData.sT = syncFireTime;

  if(equipSkills.indexOf(skillData.sID) === -1 && baseSkill !== skillData.sID){
    Manager.stopUser();
  }else{
    socket.emit(gameConfig.MTYPE_SKILL_FIRED, skillData);
    // UIManager.applySkill(skillData.skillIndex);
  }
};
function onProjectileSkillFireHandler(rawProjectileDatas, syncFireTime){
  var projectileDatas = Manager.processProjectileData(rawProjectileDatas);

  // UIManager.applySkill(projectileDatas[0].skillIndex);
  socket.emit(gameConfig.MTYPE_PROJECTILE_FIRED, projectileDatas, syncFireTime);
};
// function onCancelCastingHandler(){
//   var userData = Manager.processUserData();
//   socket.emit('castCanceled', userData);
// };
function setCanvasSize(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  if(window.innerWidth < 1200){
    UIManager.bottomToRight();
  }else{
    UIManager.rightToBottom();
  }
  if(window.innerWidth < 1024){
    UIManager.disableDisplayAd();
  }else{
    UIManager.enableDisplayAd();
  }

  gameConfig.canvasSize = {width : window.innerWidth, height : window.innerHeight};
  setCanvasScale(gameConfig);
};

function drawStartScene(){
  UIManager.drawStartScene();
};

function drawGame(){
  if(Date.now() - drawUITimer > 500){
    drawUITimer = Date.now();
    UIManager.drawGameScene();
    UIManager.drawFPSAndPing(frameCounter.lastFrameCount, latency);
  }

  gameConfig.userOffset = calcOffset();

  drawScreen();
  drawBackground();
  drawGrid();
  drawImmortalZone();
  // drawEnvironment();
  drawObjs();
  drawUserEffect();
  var drawUser = util.setDrawUser(Manager.users, Manager.user, gameConfig);
  drawUsers(drawUser);
  // drawChests();
  // drawProjectile();
  var drawMob = util.setDrawMobs(Manager.monsters, gameConfig);
  drawMobs(drawMob);
  drawObstacles();
  // drawPortalZone();
  drawUserChat(drawUser);
  drawEffect();
  // drawRiseText();
  if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
    drawSkillRange();
  }else if(continueMove){
    if(Date.now() - coninueMoveEventTime > 150 && !Manager.user.castingEndTime){
      coninueMoveEventTime = Date.now();
      userLastActionTime = Date.now();
      // mousePoint.x = e.clientX/gameConfig.scaleFactor;
      // mousePoint.y = e.clientY/gameConfig.scaleFactor;
      var worldClickPosition = util.localToWorldPosition(mousePoint, gameConfig.userOffset);

      var targetPosition = util.setTargetPosition(worldClickPosition, Manager.users[gameConfig.userID]);
      Manager.moveUser(targetPosition);

      var userData = Manager.processUserData();
      userData.targetPosition = {x : Math.floor(targetPosition.x), y : Math.floor(targetPosition.y) };
      userDataLastUpdateTime = Date.now();
      socket.emit(gameConfig.MTYPE_USER_MOVE_START, userData);
    }
  }
};

function drawRestartScene(){
  UIManager.drawRestartScene();
};

// socket connect and server response configs
// var cookie = require('cookie');
function setupSocket(url){
  // socket = io.connect(url, { 'forceNew': true, transports: ['websocket'] });
  socket = new WebSocketClient();
  // var WebSocket = require('ws');
  // var ws = new WebSocket(
  //     'http://localhost/auth',
  //     [],
  //     {
  //         'headers': {
  //             'cookie': cookie.serialize('id', '496E66DD')
  //         }
  //     }
  // );
  socket.open(url.replace('http', 'ws'));
  // socket = new WebSocket(url.replace('http', 'ws'));
  // socket.emit = function(type){
  //   var vars = [];
  //   for(var i=1; i<arguments.length; i++){
  //     vars.push(arguments[i]);
  //   }
  //   if(socket.readyState === 1){
  //     socket.send(JSON.stringify({
  //       type: type,
  //       vars: vars
  //     }));
  //   }else if(socket.readyState === 3){
  //     socket = new WebSocket(url.replace('http', 'ws'));
  //   }
  // };
  socket.onopen = function(){
    if (!_u) {
      // if (socket) {
      //   socket.close();
      // }
      // window.onbeforeunload = null;
      window.location.href = '/error';
    }

    syncCheckInterval = setInterval(function() {
      if (isSyncID) {
        clearInterval(syncCheckInterval);
        syncCheckInterval = false;

        switch (characterType) {
          case gameConfig.CHAR_TYPE_FIRE:
            currentLevel = pyroLevel;
            break;
          case gameConfig.CHAR_TYPE_FROST:
            currentLevel = frosterLevel;
            break;
          case gameConfig.CHAR_TYPE_ARCANE:
            currentLevel = mysterLevel;
            break;
        }
        // var twitter = util.getCookie(document.cookie, 'twitter');
        // var facebook = util.getCookie(document.cookie, 'facebook');
        socket.emit(gameConfig.MTYPE_REQ_START_GAME, characterType, userName);
        userPingCheckTime = Date.now();
        socket.emit(gameConfig.MTYPE_FIRE_PING, userPingCheckTime);

        if(!userDataUpdateInterval && !isFirstStart){
          socket.emit(gameConfig.MTYPE_NEED_RECONNECT);
        }
      }
    }, syncCheckTimer);
  }
  socket.onmessage = function(msg){
    cancelError();
    var data = util.decodePacket(new Uint8Array(msg.data));
    var vars = data.v;

    if (!isSyncID && data.t === gameConfig.MTYPE_SYNC_SUCCESS) { //syncSuccess
      console.log('sync success');
      isSyncID = true;
      // check is on play game
      // if not send reconnect message
      if (syncCount) {
        if (gameState !== gameConfig.GAME_STATE_GAME_ON) {
          // reconnect
          socket.emit(gameConfig.MTYPE_NEED_RECONNECT);
        }
      }
      syncCount++;
    }
    switch (data.t) {
      case gameConfig.MTYPE_DONT_CHEAT: //'dontCheat':
        if (isSyncID) { dontCheat(vars[0]); }
        break;
      case gameConfig.MTYPE_REQ_RECONNECT_RES: //'reqReconnectResource':
        reqReconnectResource();
        break;
      case gameConfig.MTYPE_RES_RECONNECT: //'resReconnect':
        resReconnect(vars[0], vars[1], vars[2], vars[3], vars[4], vars[5], vars[6]);
        break;
      case gameConfig.MTYPE_ADMIN_MESSAGE: //'adminMessage':
        adminMessage(vars[0]);
        break;
      case gameConfig.MTYPE_DOWN_SERVER: //'downServer':
        downServer(vars[0], vars[1]);
        break;
      case gameConfig.MTYPE_NOW_SERVER_IS_DOWN: //'nowServerIsDown':
        nowServerIsDown();
        break;
      case gameConfig.MTYPE_CANCEL_SERVER_DOWN: //'cancelServerDown':
        cancelServerDown();
        break;
      case gameConfig.MTYPE_FIRE_PONG: //'firePong':
        firePong(vars[0], vars[1]);
        break;
      case gameConfig.MTYPE_SYNC_AND_SET_SKILLS: //'syncAndSetSkills':
        syncAndSetSkills(vars[0]);
        break;
      case gameConfig.MTYPE_RES_START_GAME: //'resStartGame':
        resStartGame(vars[0], vars[1], vars[2], vars[3], vars[4], vars[5]);
        break;
      case gameConfig.MTYPE_RES_RESTART_GAME: //'resRestartGame':
        resRestartGame(vars[0], vars[1]);
        break;
      case gameConfig.MTYPE_USER_JOINED: //'userJoined':
        if (isSyncID) { userJoined(vars[0], vars[1]); }
        break;
      case gameConfig.MTYPE_USER_DATA_UPDATE: //'userDataUpdate':
        userDataUpdate(vars[0]);
        break;
      case gameConfig.MTYPE_USER_DATA_SYNC: //'userDataSync':
        if (isSyncID) { userDataSync(vars[0]); }
        break;
      case gameConfig.MTYPE_USER_MOVE_AND_ATTACK: //'userMoveAndAttack':
        if (isSyncID) { userMoveAndAttack(vars[0]); }
        break;
      case gameConfig.MTYPE_USER_DATA_UPDATE_AND_USER_SKILL: //'userDataUpdateAndUseSkill':
        if (isSyncID) { userDataUpdateAndUseSkill(vars[0]); }
        break;
      case gameConfig.MTYPE_SKILL_FIRED: //'skillFired':
        if (isSyncID) { skillFired(vars[0], vars[1]); }
        break;
      case gameConfig.MTYPE_PROJECTILE_FIRED: //'projectilesFired':
        if (isSyncID) { projectilesFired(vars[0], vars[1], vars[2]); }
        break;
      case gameConfig.MTYPE_MOVE_USER_TO_NEW_POS: //'moveUserToNewPos':
        if (isSyncID) { moveUserToNewPos(vars[0], vars[1]); }
        break;
      case gameConfig.MTYPE_UPGRADE_SKILL: //'upgradeSkill':
        upgradeSkill(vars[0], vars[1], vars[2]);
        break;
      case gameConfig.MTYPE_UPDATE_USER_PRIVATE_STAT: //'updateUserPrivateStat':
        updateUserPrivateStat(vars[0]);
        break;
      case gameConfig.MTYPE_DELETE_PROJECTILE: //'deleteProjectile':
        if (isSyncID) { deleteProjectile(vars[0], vars[1]); }
        break;
      case gameConfig.MTYPE_EXPLODE_PROJECTILE: //'explodeProjectile':
        if (isSyncID) { explodeProjectile(vars[0], vars[1], vars[2]); }
        break;
      case gameConfig.MTYPE_CREATE_OBJS: //'createOBJs':
        if (isSyncID) { createOBJs(vars[0]); }
        break;
      case gameConfig.MTYPE_DELETE_OBJS: //'deleteOBJ':
        if (isSyncID) { deleteOBJ(vars[0]); }
        break;
      case gameConfig.MTYPE_CREATE_CHEST: //'createChest':
        if (isSyncID) { createChest(vars[0]); }
        break;
      case gameConfig.MTYPE_CHEST_DAMAGED: //'chestDamaged':
        if (isSyncID) { chestDamaged(vars[0], vars[1]); }
        break;
      case gameConfig.MTYPE_DELETE_CHEST: //'deleteChest':
        if (isSyncID) { deleteChest(vars[0]); }
        break;
      case gameConfig.MTYPE_GET_RESOURCE: //'getResource':
        getResource(vars[0]);
        break;
      case gameConfig.MTYPE_GET_SKILL: //'getSkill':
        getSkill(vars[0], vars[1]);
        break;
      case gameConfig.MTYPE_SKILL_CHANGE_TO_RESOURCE: //'skillChangeToResource':
        skillChangeToResource(vars[0]);
        break;
      case gameConfig.MTYPE_CHANGE_USER_STAT: //'changeUserStat':
        if (isSyncID) { changeUserStat(vars[0], vars[1]); }
        break;
      case gameConfig.MTYPE_USER_DAMAGED: //'userDamaged':
        if (isSyncID) { userDamaged(vars[0], vars[1]); }
        break;
      case gameConfig.MTYPE_UPDATE_BUFF: //'updateBuff':
        if (isSyncID) { updateBuff(vars[0]); }
        break;
      case gameConfig.MTYPE_UPDATE_RANK: //'updateRank':
        if (isSyncID) { updateRank(vars[0]); }
        break;
      case gameConfig.MTYPE_CHATTING: //'chatting':
        if (isSyncID) { chatting(vars[0], vars[1]); }
        break;
      case gameConfig.MTYPE_USER_DEAD: //'userDead':
        if (isSyncID) { userDead(vars[0], vars[1], vars[2], vars[3]); } //, vars[3], vars[4], vars[5], vars[6]); }
        break;
      case gameConfig.MTYPE_USER_LEAVE: //'userLeave':
        if (isSyncID) { userLeave(vars[0], vars[1]); }
        break;
      case gameConfig.MTYPE_MOB_CREATED: //'mobCreated':
        if (isSyncID) { mobCreated(vars[0]); }
        break;
      case gameConfig.MTYPE_MOB_CHANGE_STATE: //'mobChangeState':
        if (isSyncID) { mobChangeState(vars[0]); }
        break;
      case gameConfig.MTYPE_MOB_TAKE_DAMAGE: //'mobTakeDamage':
        if (isSyncID) { mobTakeDamage(vars[0], vars[1]); }
        break;
      case gameConfig.MTYPE_MOB_UPDATE_BUFF: //'mobUpdateBuff':
        if (isSyncID) { mobUpdateBuff(vars[0]); }
        break;
      case gameConfig.MTYPE_MOB_DEAD: //'mobDead':
        if (isSyncID) { mobDead(vars[0]); }
        break;
      case gameConfig.MTYPE_ERROR_SET_ID: //'errorSetID':
        alert('Session Error');
        // if (socket) {
        //   socket.close();
        // }
        // window.onbeforeunload = null;
        window.location.href = '/error';
        break;
      case gameConfig.MTYPE_DUPLICATE_ACCESS:
        // alert('Account is used by another client.');
        // if (socket) {
        //   socket.close();
        // }
        // window.onbeforeunload = null;
        window.location.href = '/duplicate';
      default:
      if (data.t !== gameConfig.MTYPE_SYNC_SUCCESS) {
        console.warn('check type', data.t);
      }
    }
  }
  socket.onerror = function(err){
    console.error('Error', err);
  }
  socket.onclose = function(e){
    isSyncID = false;
    console.error('socket onclose : ' + e);
    if(socket){
      // socket.io.reconnecting = false;
      UIManager.playReconnectScene();
      canvasDisableEvent();
      documentDisableEvent();
      // socket.close();
      // socket.emit('needReconnect');
      // socket.io.reconnect();
      // socket.connect();
    }
    if(!errorTimeout){
      errorTimeout = setTimeout(function(){
        console.warn('disconnected ', new Date());
        // if (socket) {
        //   socket.close();
        // }
        // window.onbeforeunload = '';
        window.location.href = "/error";
      }, 30000);
    }
  }
  // socket.on('connect', function(){
  //   cancelError();
  //   console.log('connect to the server');
  //   if(!userDataUpdateInterval && !isFirstStart){
  //     socket.emit('needReconnect');
  //   }
  // });
  // socket.on('disconnect', function(){
  //   if(socket){
  //     socket.io.reconnecting = false;
  //     console.log('reconnect');
  //     UIManager.playReconnectScene();
  //     canvasDisableEvent();
  //     documentDisableEvent();
  //
  //     socket.io.reconnect();
  //     // socket.connect();
  //   }
  //   errorTimeout = setTimeout(function(){
  //     console.log('disconnected');
  //     console.log(Date.now());
  //     window.onbeforeunload = '';
  //     window.location.href = "/error"
  //   }, 20000);
  //   // changeState(gameConfig.GAME_STATE_RESTART_SCENE);
  // });

  // socket.on('dontCheat', function(beforePosition){
  function dontCheat(beforePosition){
    // cancelError();
    if(util.isNumeric(beforePosition.x) && util.isNumeric(beforePosition.y)){
      Manager.moveUserToNewPos(gameConfig.userID, beforePosition);
    }
  }
  // socket.on('reqReconnectResource', function(){
  function reqReconnectResource(){
    clearInterval(userDataUpdateInterval);

    // cancelError();
    // var skills = {};
    // skills.baseSkill = baseSkill;
    // skills.equipSkills = equipSkills;
    // skills.inherentPassiveSkill = inherentPassiveSkill;
    // skills.possessSkills = possessSkills;
    var position = Manager.getUserPosition(gameConfig.userID);
    // var exp = Manager.getUserExp(gameConfig.userID);
    // var resources = UIManager.getResource();
    var HP = Manager.getUserHP(gameConfig.userID);
    var MP = Manager.getUserMP(gameConfig.userID);
    socket.emit(gameConfig.MTYPE_REQ_RECONNECT, userName, characterType, {
      // level : currentLevel,
      // exp : exp,
      HP : HP,
      MP : MP
    }, equipSkills, killCount, totalKillCount, position);// skills, killCount, totalKillCount, position, resources);
  }
  // socket.on('resReconnect', function(userData, userDatas, buffDatas, objDatas, chestDatas, rankDatas){
  function resReconnect(rawUserData, rawUserDatas, rawBuffDatas, rawObjDatas, chestDatas, rawRankDatas, rawMobDatas){
    // cancelError();
    // gameConfig.userID = userData.objectID;
    var userData = util.processUserData(rawUserData);
    var userDatas = [];
    for (var i=0; i<rawUserDatas.length; i++) {
      userDatas.push(util.processUserData(rawUserDatas[i]));
    }
    var buffDatas = util.processBuffDatas(rawBuffDatas);
    var objDatas = util.processObjDatas(rawObjDatas);
    var rankDatas = util.processScoreDatas(rawRankDatas);
    var mobDatas = util.processMobDatas(rawMobDatas);

    gameConfig.userID = userData.oID;
    Manager.resetUsers(userDatas, gameConfig.scaleFactor);
    for(var i=0; i<buffDatas.length; i++){
      updateUserBuff(buffDatas[i]);
    }
    Manager.resetObjs(objDatas);
    Manager.resetChests(chestDatas);
    Manager.resetMobs(mobDatas);

    Manager.synchronizeUser(gameConfig.userID);
    Manager.onMainUserMove = function(user){
      UIManager.updateUserPosition(user.position);
    }
    UIManager.setBoard(rankDatas, gameConfig.userID);

    var chestLocationDatas = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_CHEST_GROUND));
    UIManager.setMiniMapChests(chestDatas, chestLocationDatas);

    if(gameState === gameConfig.GAME_STATE_GAME_ON){
      canvasAddEvent();
      documentAddEvent();
      userDataUpdateInterval = setInterval(updateUserDataHandler, INTERVAL_TIMER);
    }else{
      UIManager.disableDeadScene();
      UIManager.disableStandingScene();
      // if(restartTimeout){
      //   clearTimeout(restartTimeout);
      //   restartTimeout = false;
      // }
      changeState(gameConfig.GAME_STATE_RESTART);
    }
    Manager.setUserInitState(gameConfig.userID);
    UIManager.disableReconnectScene();

    socket.emit(gameConfig.MTYPE_RECONNECT_SUCCESS);
  }
  // socket.on('adminMessage', function(msg){
  function adminMessage(msg){
    // cancelError();
    UIManager.makeAdminMessage(msg);
  }
  // socket.on('downServer', function(msg, time){
  function downServer(msg, time){
    // cancelError();
    UIManager.makeDownMessage(msg, time);
  }
  // socket.on('nowServerIsDown', function(){
  function nowServerIsDown(){
    // if (socket) {
    //   socket.close();
    // }
    // window.onbeforeunload = '';
    window.location.href = "/serverdown"
  }
  // socket.on('cancelServerDown', function(){
  function cancelServerDown(){
    // cancelError();
    UIManager.makeAdminMessage('Server down canceled.');
    UIManager.cancelDown();
  }
  // socket.on('firePong', function(date, serverDate){
  function firePong(date, serverDate){
    // cancelError();
    latency = Date.now() - date;
    timeDiff = Date.now() - (serverDate + latency/2);
    socket.emit(gameConfig.MTYPE_UPDATE_USER_TIME_DIFF, Date.now(), latency);
  }
  // socket.on('syncAndSetSkills', function(user){
  function syncAndSetSkills(data){
    // cancelError();
    //synchronize user
    var user = util.processUserAddData(data);
    var startTime = Date.now();
    // gameConfig.userID = user.objectID;
    gameConfig.userID = user.oID;
    // gameConfig.userOffset = util.calculateOffset(user, gameConfig.canvasSize);

    baseSkill = user.bS;
    baseSkillData = objectAssign({}, util.findData(skillTable, 'index', user.bS));
    inherentPassiveSkill = user.ipS;
    inherentPassiveSkillData = objectAssign({}, util.findData(skillTable, 'index', user.ipS));
    for(var i=0; i<4; i++){
      if(user.eS[i]){
        equipSkills[i] = user.eS[i];
      }else{
        equipSkills[i] = undefined;
      }
    }
    for(var i=0; i<4; i++){
      if(user.eS[i]){
        equipSkillDatas[i] = objectAssign({}, util.findData(skillTable, 'index', user.eS[i]));
      }else{
        equipSkillDatas[i] = undefined;
      }
    };
    var allEquipSkills = user.aS;
    if (allEquipSkills && allEquipSkills.length) {
      for (var i=0; i<allEquipSkills[0].length; i++) {
        pyroEquipSkills[i] = allEquipSkills[0][i];
      }
      for (var i=0; i<allEquipSkills[1].length; i++) {
        frosterEquipSkills[i] = allEquipSkills[1][i];
      }
      for (var i=0; i<allEquipSkills[2].length; i++) {
        mysterEquipSkills[i] = allEquipSkills[2][i];
      }
      // pyroEquipSkills = allEquipSkills[0];
      // frosterEquipSkills = allEquipSkills[1];
      // mysterEquipSkills = allEquipSkills[2];
    }

    possessSkills = user.pS;

    UIManager.syncSkills(baseSkill, baseSkillData, equipSkills, equipSkillDatas, possessSkills, inherentPassiveSkill, inherentPassiveSkillData);
    UIManager.setHUDSkills();
    UIManager.updateBuffIcon();
    UIManager.setHUDStats(user);
    UIManager.updateCondition(user.cdt);
    UIManager.setCooldownReduceRate(user.cRR);
    UIManager.setPopUpSkillChange();
    UIManager.setResource(user);

    UIManager.setUserPosition(user.pos);
  }

  //change state game on
  // socket.on('resStartGame', function(userDatas, buffDatas, objDatas, chestDatas, rankDatas){
  function resStartGame(rawUserDatas, rawBuffDatas, rawObjDatas, chestDatas, rawRankDatas, rawMobDatas){
    // cancelError();
    isFirstStart = false;
    var userDatas = [];
    for (var i=0; i<rawUserDatas.length; i++) {
      userDatas.push(util.processUserData(rawUserDatas[i]));
    }
    var buffDatas = util.processBuffDatas(rawBuffDatas);
    var objDatas = util.processObjDatas(rawObjDatas);
    var rankDatas = util.processScoreDatas(rawRankDatas);
    var mobDatas = util.processMobDatas(rawMobDatas);

    Manager.start();
    Manager.setUsers(userDatas, gameConfig.scaleFactor);
    for(var i=0; i<buffDatas.length; i++){
      updateUserBuff(buffDatas[i]);
    }
    // Manager.setUsersSkills(skillDatas);
    // Manager.setProjectiles(projectileDatas);
    Manager.setObjs(objDatas);
    Manager.setChests(chestDatas);
    Manager.setMobs(mobDatas);

    Manager.synchronizeUser(gameConfig.userID);
    Manager.onMainUserMove = function(user){
      UIManager.updateUserPosition(user.position);
    }

    if (_u && _u.f) {
      var tutorialSkill = gameConfig.TUTORIAL_SKILL_FIRE_INDEX;
      switch (characterType) {
        case gameConfig.CHAR_TYPE_FIRE:
        tutorialSkill = gameConfig.TUTORIAL_SKILL_FIRE_INDEX;
        break;
        case gameConfig.CHAR_TYPE_FROST:
        tutorialSkill = gameConfig.TUTORIAL_SKILL_FROST_INDEX;
        break;
        case gameConfig.CHAR_TYPE_ARCANE:
        tutorialSkill = gameConfig.TUTORIAL_SKILL_ARCANE_INDEX;
        break;
      }
      UIManager.setNewSkill(tutorialSkill);
    }
    var chestLocationDatas = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.OBJ_TYPE_CHEST_GROUND));
    var safeZoneDatas = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.ENV_TYPE_IMMORTAL_GROUND));
    var portalZoneDatas = objectAssign({}, util.findAllDatas(obstacleTable, 'type', gameConfig.ENV_TYPE_PORTAL));

    UIManager.setBoard(rankDatas, gameConfig.userID);
    UIManager.setMiniMapChests(chestDatas, chestLocationDatas);
    UIManager.setMinimapZones(safeZoneDatas, portalZoneDatas);
    // console.log(Manager.users);

    canvasAddEvent();
    documentAddEvent();

    changeState(gameConfig.GAME_STATE_GAME_ON);
    userDataUpdateInterval = setInterval(updateUserDataHandler, INTERVAL_TIMER);
  }
  // socket.on('resRestartGame', function(userData, rankDatas){
  function resRestartGame(rawUserData, rawRankDatas){
    // cancelError();
    var userData = util.processUserAddReData(rawUserData);
    var rankDatas = util.processScoreDatas(rawRankDatas);

    Manager.iamRestart(userData, gameConfig.scaleFactor);
    Manager.setUserData(userData);
    Manager.changeUserStat(userData, true, gameConfig.scaleFactor);
    UIManager.updateCondition(userData.cdt);
    UIManager.updateMP(userData)
    UIManager.checkSkillsConditions();

    canvasAddEvent();
    documentAddEvent();

    baseSkill = userData.bS;
    baseSkillData = objectAssign({}, util.findData(skillTable, 'index', userData.bS));
    inherentPassiveSkill = userData.ipS;
    inherentPassiveSkillData = objectAssign({}, util.findData(skillTable, 'index', userData.ipS));

    switch (characterType) {
      case gameConfig.CHAR_TYPE_FIRE:
        for(var i=0; i<4; i++){
          equipSkills[i] = pyroEquipSkills[i];
        }
        break;
      case gameConfig.CHAR_TYPE_FROST:
        for(var i=0; i<4; i++){
          equipSkills[i] = frosterEquipSkills[i];
        }
        break;
      case gameConfig.CHAR_TYPE_ARCANE:
        for(var i=0; i<4; i++){
          equipSkills[i] = mysterEquipSkills[i];
        }
        break;
    }

    for(var i=0; i<4; i++){
      if(equipSkills[i]){
        equipSkillDatas[i] = objectAssign({}, util.findData(skillTable, 'index', equipSkills[i]));
      }else{
        equipSkillDatas[i] = undefined;
      }
    };

    possessSkills = userData.pS;

    UIManager.syncSkills(baseSkill, baseSkillData, equipSkills, equipSkillDatas, possessSkills, inherentPassiveSkill, inherentPassiveSkillData);
    UIManager.setHUDSkills();
    // UIManager.updateBuffIcon();
    UIManager.setHUDStats(userData);
    UIManager.setCooldownReduceRate(userData.cRR);
    UIManager.setPopUpSkillChange();
    UIManager.updateBoard(rankDatas, gameConfig.userID);
    UIManager.updateHP(userData);
    UIManager.updateMP(userData);
    UIManager.setUserPosition(userData.pos);

    changeState(gameConfig.GAME_STATE_GAME_ON);
    Manager.setUserInitState(gameConfig.userID);
    userDataUpdateInterval = setInterval(updateUserDataHandler, INTERVAL_TIMER);
  }
  // socket.on('userJoined', function(data, rankDatas){
  function userJoined(rawData, rawRankDatas){
    var data = util.processUserData(rawData);
    var rankDatas = util.processScoreDatas(rawRankDatas);

    // cancelError();
    // data.imgData = Manager.setImgData(data);
    Manager.setUser(data, gameConfig.scaleFactor);
    UIManager.updateBoard(rankDatas, gameConfig.userID);
    Manager.setUserInitState(data.oID);
    // Manager.setUserInitState(data.objectID);
  }
  // socket.on('userDataUpdate', function(userData){
  function userDataUpdate(rawData){
    // cancelError();
    var userData = util.processUserData(rawData);
    Manager.updateUserData(userData);
  }
  // socket.on('userDataSync', function(userData){
  function userDataSync(rawData){
    // cancelError();
    var userData = util.processUserData(rawData);
    Manager.syncUserData(userData);
  }
  // socket.on('userMoveAndAttack', function(userData){
  function userMoveAndAttack(rawData){
    // cancelError();
    var userData = util.processUserMAData(rawData);
    var skillData = objectAssign({}, util.findData(skillTable, 'index', userData.sID));
    skillData.targetPosition = userData.sTPos;
    Manager.moveAndAttackUser(userData.oID, userData.tpos, skillData, userData.mB);
    // Manager.moveAndAttackUser(userData.objectID, userData.targetPosition, skillData, userData.moveBackward);
  }
  // socket.on('userDataUpdateAndUseSkill', function(userData){
  function userDataUpdateAndUseSkill(rawData){
    // cancelError();
    var userData = util.processUserUSData(rawData);
    Manager.updateUserData(userData);

    var skillData = objectAssign({}, util.findData(skillTable, 'index', userData.sID));

    Manager.applyCastSpeed(userData.oID, skillData);
    // Manager.applyCastSpeed(userData.objectID, skillData);
    skillData.targetPosition = userData.sTPos;
    skillData.direction = userData.sDir;
    if(skillData.type === gameConfig.SKILL_TYPE_PROJECTILE ||
       skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK ||
       skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION ||
       skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION ||
       skillData.type === gameConfig.SKILL_TYPE_INSTANT_PROJECTILE){
      skillData.projectileIDs = userData.sPIDs;
    }
    Manager.useSkill(userData.oID, skillData);
    // Manager.useSkill(userData.objectID, skillData);
  }
  // socket.on('skillFired', function(data, userID){
  function skillFired(data, userID){
    // cancelError();
    var clientSyncFireTime = data.sT + timeDiff;
    var timeoutTime = clientSyncFireTime - Date.now();
    if(timeoutTime < 0){
      timeoutTime = 0;
    }
    setTimeout(function(){
      var skillData = objectAssign({}, util.findData(skillTable, 'index', data.sID));
      skillData.targetPosition = data.sTPos;
      if(skillData.explosionEffectGroup){
        var effectImgData = objectAssign({}, util.findData(effectGroupTable, 'index', skillData.explosionEffectGroup));
        util.setResourceData(resourceTable, effectImgData);
      }
      if(userID === gameConfig.userID){
        UIManager.applySkill(skillData.index);
      }
      Manager.applySkill(skillData, userID, effectImgData);
    }, timeoutTime);
  }
  // socket.on('projectilesFired', function(datas, syncFireTime, userID){
  function projectilesFired(datas, syncFireTime, userID){
    // cancelError();
    var clientSyncFireTime = syncFireTime + timeDiff;
    var timeoutTime = clientSyncFireTime - Date.now();
    if(timeoutTime < 0){
      timeoutTime = 0;
    }
    setTimeout(function(){
      for(var i=0; i<datas.length; i++){
        var skillData = objectAssign({}, util.findData(skillTable, 'index', datas[i].sID));
        skillData.userID = userID;
        skillData.objectID = datas[i].oID;
        skillData.position = datas[i].pos;
        skillData.speed = datas[i].sp;
        skillData.startTime = Date.now();

        if(userID == gameConfig.userID){
          UIManager.applySkill(skillData.index);
        }
        if(skillData.projectileEffectGroup){
          var projectileImgData = objectAssign({}, util.findData(effectGroupTable, 'index', skillData.projectileEffectGroup));
          util.setResourceData(resourceTable, projectileImgData);
        }
        if(skillData.explosionEffectGroup){
          var effectImgData = objectAssign({}, util.findData(effectGroupTable, 'index', skillData.explosionEffectGroup));
          util.setResourceData(resourceTable, effectImgData);
        }
        Manager.applyProjectile(skillData, projectileImgData, effectImgData);
      }
    }, timeoutTime);
  }
  // socket.on('moveUserToNewPos', function(userID, pos){
  function moveUserToNewPos(userID, pos){
    // cancelError();
    Manager.moveUserToNewPos(userID, pos);
    // if (userID == gameConfig.userID) {
    //   UIManager.disableFieldUIs();
    // }
  }
  // socket.on('upgradeSkill', function(beforeSkillIndex, afterSkillIndex, resourceData){
  function upgradeSkill(beforeSkillIndex, afterSkillIndex, resourceData){
    // cancelError();
    UIManager.setResource(resourceData);
    if(beforeSkillIndex === baseSkill){
      baseSkill = afterSkillIndex;
      baseSkillData = objectAssign({}, util.findData(skillTable, 'index', afterSkillIndex));
      UIManager.upgradeBaseSkill(baseSkill, baseSkillData);
    }else if(beforeSkillIndex === inherentPassiveSkill){
      inherentPassiveSkill = afterSkillIndex;
      inherentPassiveSkillData = objectAssign({}, util.findData(skillTable, 'index', afterSkillIndex));
      UIManager.upgradeInherentSkill(inherentPassiveSkill, inherentPassiveSkillData);
    }else{
      for(var i=0; i<4; i++){
        var skillData = objectAssign({}, util.findData(skillTable, 'index', afterSkillIndex));
        if(equipSkills[i] === beforeSkillIndex){
          equipSkills.splice(i, 1, afterSkillIndex);
          equipSkillDatas.splice(i, 1, skillData);
        }
        if(pyroEquipSkills[i] === beforeSkillIndex){
          pyroEquipSkills.splice(i, 1, afterSkillIndex);
        }
        if(frosterEquipSkills[i] === beforeSkillIndex){
          frosterEquipSkills.splice(i, 1, afterSkillIndex);
        }
        if(mysterEquipSkills[i] === beforeSkillIndex){
          mysterEquipSkills.splice(i, 1, afterSkillIndex);
        }
      }
      for(var i=0; i<possessSkills.length; i++){
        if(possessSkills[i] === beforeSkillIndex){
          possessSkills.splice(i, 1, afterSkillIndex);
          UIManager.upgradePossessionSkill(beforeSkillIndex, afterSkillIndex);
          break;
        }
      }
    }
    UIManager.playSkillUpgradeEffect();
    updateCharTypeSkill(characterType);
  }
  // socket.on('updateUserPrivateStat', function(statData){
  function updateUserPrivateStat(rawStatData){
    var statData = util.processUserPrivateData(rawStatData);
    // cancelError();
    UIManager.setHUDStats(statData);
    UIManager.setCooldownReduceRate(statData.cRR);
  }
  // socket.on('deleteProjectile', function(projectileID, userID){
  function deleteProjectile(projectileID, userID){
    // cancelError();
    Manager.deleteProjectile(projectileID, userID);
  }
  // socket.on('explodeProjectile', function(projectileID, userID, position){
  function explodeProjectile(projectileID, userID, position){
    // cancelError();
    Manager.explodeProjectile(projectileID, userID, position);
  }
  // socket.on('castCanceled', function(userID){
  //   Manager.cancelCasting(userID);
  // });
  // socket.on('createOBJs', function(objDatas){
  function createOBJs(rawObjDatas){
    // cancelError();
    var objDatas = util.processObjDatas(rawObjDatas);
    Manager.setObjs(objDatas);
    // Manager.createOBJs(objDatas);
  }
  // socket.on('deleteOBJ', function(objID){
  function deleteOBJ(objID){
    // cancelError();
    Manager.deleteOBJ(objID);
  }
  // socket.on('createChest', function(chestData){
  function createChest(chestData){
    // cancelError();
    Manager.createChest(chestData);
    UIManager.createChest(chestData.lID, chestData.gd);
  }
  // socket.on('chestDamaged', function(locationID, HP){
  function chestDamaged(locationID, HP){
    // cancelError();
    Manager.updateChest(locationID, HP);
    if(hittedChest.indexOf(locationID)){
      hittedChest.push(locationID);
      setTimeout(function(){
        var index = hittedChest.indexOf(locationID);
        hittedChest.splice(index, 1);
      }, gameConfig.SKILL_HIT_EFFECT_TIME);
    }
  }
  // socket.on('deleteChest', function(locationID){
  function deleteChest(locationID){
    // cancelError();
    Manager.deleteChest(locationID);
    UIManager.deleteChest(locationID);
  }
  // socket.on('getResource', function(resourceData, addResource){
  function getResource(addResource){
    // cancelError();
    UIManager.makeRisingMessage(addResource);
    // UIManager.setResource(resourceData);
  }
  // socket.on('getSkill', function(skillIndex){
  function getSkill(skillIndex, possessSkills){
    // cancelError();
    var skillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));
    UIManager.makeRisingMessageForSkill(skillData, false);
    if(possessSkills){
      updateSkillPossessions(possessSkills);
    }
  }
  // socket.on('skillChangeToResource', function(skillIndex){
  function skillChangeToResource(skillIndex){
    // cancelError();
    var skillData = objectAssign({}, util.findData(skillTable, 'index', skillIndex));
    // UIManager.addResource(skillData.exchangeToGold, skillData.exchangeToJewel);
    UIManager.makeRisingMessageForSkill(skillData, true);
  }
  // socket.on('changeUserStat', function(userData, addResource){
  function changeUserStat(rawUserData){
    // cancelError();
    var userData = util.processUserStatData(rawUserData);
    if(userData.oID === gameConfig.userID){
      UIManager.updateCondition(userData.cdt);
      UIManager.updateHP(userData);
      UIManager.updateMP(userData);
      UIManager.checkSkillsConditions();
      // if(addResource){
      //   UIManager.makeRisingMessage(addResource);
      // }
      var needExp = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', characterType, 'level', userData.lv)).needExp;
      UIManager.updateExp(userData, needExp);

      // var beforeHP = Manager.getUserHP(userData.objectID);
      // var beforeExp = Manager.getUserExp(userData.objectID);
    }
    Manager.changeUserStat(userData, false, gameConfig.scaleFactor);
    // if(userData.oID === gameConfig.userID){
    //   UIManager.updateHP(userData);
    //   UIManager.updateMP(userData);
    //
    //   var needExp = objectAssign({}, util.findDataWithTwoColumns(userStatTable, 'type', characterType, 'level', userData.lv)).needExp;
    //   UIManager.updateExp(userData, needExp);
    // }
    // if(userData.objectID === gameConfig.userID){
    //   var afterHP = Manager.getUserHP(userData.objectID);
    //   var afterExp = Manager.getUserExp(userData.objectID);
    //   var userCenter = Manager.getUserCenter(userData.objectID);
    //   if(userCenter){
    //     if(beforeHP !== afterHP){
    //       Manager.addRiseText('HP ' + (afterHP - beforeHP), 'rgb(0, 0, 255)', userCenter);
    //     }
    //     if(afterExp > beforeExp){
    //       Manager.addRiseText('EXP ' + (afterExp - beforeExp), 'rgb(255, 255, 0)', userCenter);
    //     }
    //   }
    // }
  }
  // socket.on('userDamaged', function(userData, skillIndex){
  function userDamaged(rawUserData, skillIndex){
    // cancelError();
    var userData = util.processUserStatData(rawUserData);
    if(skillIndex){
      var skillImgDataIndex = objectAssign({}, util.findData(skillTable, 'index', skillIndex)).hitEffectGroup;
      var skillImgData = objectAssign({}, util.findData(effectGroupTable, 'index', skillImgDataIndex));
      var hasResource = util.setResourceData(resourceTable, skillImgData);
      if(hasResource){
        Manager.updateSkillHitImgData(userData.oID, skillImgData);
      }
    }
    Manager.changeUserStat(userData, false, gameConfig.scaleFactor);
    if(userData.oID === gameConfig.userID){
      UIManager.updateHP(userData);
      UIManager.updateMP(userData);
      UIManager.updateCondition(userData.cdt);
      UIManager.checkSkillsConditions();
    }
  }
  // socket.on('updateBuff', function(buffData){
  function updateBuff(rawBuffData){
    // cancelError();
    var buffData = util.processBuffData(rawBuffData);
    if(buffData.oID === gameConfig.userID){
      UIManager.updateBuffIcon(buffData.pL, buffData.bL, buffData.aL, timeDiff);
      if (!buffData.aL.length && gameState === gameConfig.GAME_STATE_GAME_ON) {
        UIManager.disableFieldUIs();
        isOnField = true;
        UIManager.closePopUpSkillChange();
        // disable popup
      } else {
        UIManager.enableFieldUIs();
        isOnField = false;
      }
    }
    updateUserBuff(buffData);
    //set buffImg data
    // var buffImgDataList = [];
    //
    // var buffGroupData = objectAssign({}, util.findData(skillTable, 'index', buffData.inherentPassive)).buffToSelf
    // var buffImgDataIndex = objectAssign({}, util.findData(buffGroupTable, 'index', buffGroupData)).buffEffectGroup;
    // var buffImgData = objectAssign({}, util.findData(effectGroupTable, 'index', buffImgDataIndex));
    // var hasResource = util.setResourceData(resourceTable, buffImgData);
    // if(hasResource){
    //   buffImgDataList.push(buffImgData);
    // }
    // for(var i=0; i<buffData.buffList.length; i++){
    //   buffImgDataIndex = objectAssign({}, util.findData(buffGroupTable, 'index', buffData.buffList[i].index)).buffEffectGroup;
    //   buffImgData = objectAssign({}, util.findData(effectGroupTable, 'index', buffImgDataIndex));
    //   hasResource = util.setResourceData(resourceTable, buffImgData);
    //   if(hasResource){
    //     buffImgDataList.push(buffImgData);
    //   }
    // }
    // for(var i=0; i<buffData.passiveList.length; i++){
    //   buffImgDataIndex = objectAssign({}, util.findData(buffGroupTable, 'index', buffData.passiveList[i])).buffEffectGroup;
    //   buffImgData = objectAssign({}, util.findData(effectGroupTable, 'index', buffImgDataIndex));
    //   hasResource = util.setResourceData(resourceTable, buffImgData);
    //   if(hasResource){
    //     buffImgDataList.push(buffImgData);
    //   }
    // }
    // Manager.updateUserBuffImgData(buffData.objectID, buffImgDataList);
  }
  // socket.on('updateSkillPossessions', function(possessSkillIndexes){
  function updateSkillPossessions(possessSkillIndexes){
    // cancelError();
    Manager.updateSkillPossessions(gameConfig.userID, possessSkillIndexes);
    var newSkills = [];
    if(possessSkills.length !== possessSkillIndexes.length){
      for(var i=0; i<possessSkillIndexes.length; i++){
        // if(!possessSkills.includes(possessSkillIndexes[i])){
        // if(!util.includes(possessSkills, possessSkillIndexes[i]))){
        if(possessSkills.indexOf(possessSkillIndexes[i]) === -1 ){
          newSkills.push(possessSkillIndexes[i]);
        }
      }
    }
    possessSkills = possessSkillIndexes;
    if(newSkills.length){
      UIManager.updateNewSkills(newSkills);
    }
    UIManager.updatePossessionSkills(possessSkills);
    UIManager.setPopUpSkillChange(false, true);
  }
  // socket.on('updateRank', function(rankDatas){
  function updateRank(rawScoreDatas){
    var scoreDatas = util.processScoreDatas(rawScoreDatas);
    // cancelError();
    UIManager.updateBoard(scoreDatas, gameConfig.userID);
  }
  // socket.on('chatting', function(userID, msg){
  function chatting(userID, msg){
    // cancelError();
    Manager.setUserChatMsg(userID, msg);
  }
  // socket.on('userDead', function(attackUserInfo, deadUserInfo, scoreDatas, levelDatas, loseResources, changeSkills, changeCharSkills){
  function userDead(attackUserInfo, deadUserInfo, rawScoreDatas, deadUserCalcInfo) { //, levelDatas, loseResources, changeSkills, changeCharSkills){
    var scoreDatas = util.processScoreDatas(rawScoreDatas);
    // cancelError();
    UIManager.updateKillBoard(attackUserInfo, deadUserInfo);
    if(deadUserInfo.uID === gameConfig.userID){
      Manager.iamDead();

      targetJewel = deadUserCalcInfo.j;
      targetGold = deadUserCalcInfo.g;
      targetLevel = deadUserCalcInfo.l;
      targetExp = deadUserCalcInfo.e;

      // updateCharTypeLevel();
      // isInherentSomething = checkInherent(levelDatas);
      // pyroLevel = levelDatas.pLv;
      // frosterLevel = levelDatas.fLv;
      // mysterLevel = levelDatas.mLv;

      killUser = attackUserInfo.nm;
      // loseResource = {gold : loseResources.gL, jewel : loseResources.jL};
      // if(changeSkills){
      //   updateSkills(changeSkills);
      //   isLostSkill = true;
      //   lostSkills = changeSkills.lS;
      // }else{
      //   lostSkills = [];
      //   isLostSkill = false;
      // }
      // updateCharSkills(changeCharSkills);
      changeState(gameConfig.GAME_STATE_END);
    }
    Manager.kickUser(deadUserInfo.uID);
    UIManager.updateBoard(scoreDatas, gameConfig.userID);
  }
  // socket.on('userLeave', function(objID, rankDatas){
  function userLeave(objID, rawRankDatas){
    // cancelError();
    var rankDatas = util.processScoreDatas(rawRankDatas);

    Manager.kickUser(objID);
    UIManager.updateBoard(rankDatas, gameConfig.userID);
  }
  function mobCreated(rawMobDatas){
    var mobDatas = util.processMobDatas(rawMobDatas);
    Manager.setMobs(mobDatas);
  }
  function mobChangeState(rawMobData){
    var mobData = util.processMobData(rawMobData);
    Manager.changeStateMob(mobData);
  }
  function mobTakeDamage(rawMobData, skillIndex){
    var mobData = util.processMobStatData(rawMobData);
    Manager.updateMob(mobData);
    if(skillIndex){
      var skillImgDataIndex = objectAssign({}, util.findData(skillTable, 'index', skillIndex)).hitEffectGroup;
      var skillImgData = objectAssign({}, util.findData(effectGroupTable, 'index', skillImgDataIndex));
      var hasResource = util.setResourceData(resourceTable, skillImgData);
      if(hasResource){
        Manager.updateMobHitImgData(mobData.oID, skillImgData);
      }
    }
  }
  function mobUpdateBuff(rawBuffData){
    var buffData = util.processMobBuffData(rawBuffData);
    updateMobBuff(buffData.oID, buffData.bL);
  }
  function mobDead(mobID){
    Manager.deleteMob(mobID);
  }
};
function cancelError(){
  if(errorTimeout){
    clearTimeout(errorTimeout);
    errorTimeout = false;
  }
}

//draw
function drawScreen(){
  //draw background
  if(gameConfig.userOffset.x <= 0 || gameConfig.userOffset.y <= 0 ||
     gameConfig.userOffset.x >= gameConfig.CANVAS_MAX_SIZE.width - gameConfig.CANVAS_MAX_LOCAL_SIZE.width ||
     gameConfig.userOffset.y >= gameConfig.CANVAS_MAX_SIZE.height - gameConfig.CANVAS_MAX_LOCAL_SIZE.height){
    ctx.fillStyle = "rgb(103, 124, 81)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
};
function drawObstacles(){
  var clearImg = false;
  if(Date.now() - collisionClearTime >= gameConfig.IMG_COLLISION_CLEAR_TIME){
    clearImg = true;
    collisionClearTime = Date.now();
  }

  //draw rock and chestGround
  for(var i=0; i<Manager.obstacles.length - Manager.treesCount; i++){
    var center = util.worldToLocalPosition(Manager.obstacles[i].center, gameConfig.userOffset, gameConfig.scaleFactor);
    if(util.isObjInCanvas(center, Manager.obstacles[i].imgData.width/2, gameConfig)){
      ctx.drawImage(resourceObject, Manager.obstacles[i].imgData.srcPosX, Manager.obstacles[i].imgData.srcPosY, Manager.obstacles[i].imgData.srcWidth, Manager.obstacles[i].imgData.srcHeight,
                    center.x - (Manager.obstacles[i].imgData.width/2) * gameConfig.scaleFactor, center.y - (Manager.obstacles[i].imgData.height/2) * gameConfig.scaleFactor, Manager.obstacles[i].imgData.width * gameConfig.scaleFactor, Manager.obstacles[i].imgData.height * gameConfig.scaleFactor);
      if(Manager.obstacles[i].staticEle.isCollide){
        //draw hitMask
        ctx.beginPath();
        ctx.arc(center.x, center.y, Manager.obstacles[i].imgData.width/2 * 0.9 * gameConfig.scaleFactor, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
        ctx.fill();
        ctx.closePath();
      }
      if(clearImg){
        Manager.obstacles[i].staticEle.isCollide = false;
      }
    }
  }

  drawProjectile();
  drawChests();
  drawPortalZone();
  //draw trees
  for(var i=Manager.obstacles.length - Manager.treesCount; i<Manager.obstacles.length; i++){
    var center = util.worldToLocalPosition(Manager.obstacles[i].center, gameConfig.userOffset, gameConfig.scaleFactor);
    if(util.isObjInCanvas(center, Manager.obstacles[i].imgData.width/2, gameConfig)){
      if(Manager.obstacles[i].treeImgEle.isCollide){
        ctx.drawImage(resourceObject, obstacleTreeInsideImgData.srcPosX, obstacleTreeInsideImgData.srcPosY, obstacleTreeInsideImgData.srcWidth, obstacleTreeInsideImgData.srcHeight,
          center.x - (Manager.obstacles[i].imgData.width/2) * gameConfig.scaleFactor, center.y - (Manager.obstacles[i].imgData.height/2) * gameConfig.scaleFactor, Manager.obstacles[i].imgData.width * gameConfig.scaleFactor, Manager.obstacles[i].imgData.height * gameConfig.scaleFactor);
      }else{
        ctx.drawImage(resourceObject, Manager.obstacles[i].imgData.srcPosX, Manager.obstacles[i].imgData.srcPosY, Manager.obstacles[i].imgData.srcWidth, Manager.obstacles[i].imgData.srcHeight,
          center.x - (Manager.obstacles[i].imgData.width/2) * gameConfig.scaleFactor, center.y - (Manager.obstacles[i].imgData.height/2) * gameConfig.scaleFactor, Manager.obstacles[i].imgData.width * gameConfig.scaleFactor, Manager.obstacles[i].imgData.height * gameConfig.scaleFactor);
      }
      if(clearImg){
        Manager.obstacles[i].treeImgEle.isCollide = false;
      }
      if(Manager.obstacles[i].staticEle.isCollide){
        //draw hitMask
        ctx.beginPath();
        ctx.arc(center.x, center.y, Manager.obstacles[i].imgData.width/2 * 0.9 * gameConfig.scaleFactor, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
        ctx.fill();
        ctx.closePath();
      }
      if(clearImg){
        Manager.obstacles[i].staticEle.isCollide = false;
      }
    }
  }
};
function drawChests(){
  // ctx.fillStyle = "#00ff00";
  for(var i=0; i<Manager.chests.length; i++){
    ctx.beginPath();
    var center = util.worldToLocalPosition(Manager.chests[i].center, gameConfig.userOffset, gameConfig.scaleFactor);
    ctx.drawImage(resourceObject, Manager.chests[i].imgData.srcPosX, Manager.chests[i].imgData.srcPosY, Manager.chests[i].imgData.srcWidth, Manager.chests[i].imgData.srcHeight,
                  center.x - (Manager.chests[i].imgData.width/2) * gameConfig.scaleFactor, center.y - (Manager.chests[i].imgData.height/2) * gameConfig.scaleFactor, Manager.chests[i].imgData.width * gameConfig.scaleFactor, Manager.chests[i].imgData.height * gameConfig.scaleFactor);
    if(hittedChest.indexOf(Manager.chests[i].locationID) !== -1){
      var pos = util.worldToLocalPosition(Manager.chests[i].position, gameConfig.userOffset, gameConfig.scaleFactor);
      ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
      ctx.fillRect(pos.x, (pos.y - 2.5), Manager.chests[i].imgData.width * 0.85 * gameConfig.scaleFactor, Manager.chests[i].imgData.height * 0.85 * gameConfig.scaleFactor);
    }
    // var pos = util.worldToLocalPosition(Manager.chests[i].position, gameConfig.userOffset);
    // ctx.fillRect(pos.x * gameConfig.scaleFactor, pos.y * gameConfig.scaleFactor,
    //               Manager.chests[i].size.width * gameConfig.scaleFactor, Manager.chests[i].size.height * gameConfig.scaleFactor);

    ctx.fillStyle = "#ff0000";
    var width = Manager.chests[i].HP / Manager.chests[i].maxHP * 85 * gameConfig.scaleFactor;
    var height = 10 * gameConfig.scaleFactor;
    var centerX = center.x - 42.5 * gameConfig.scaleFactor;
    var centerY = center.y + 60 * gameConfig.scaleFactor;
    ctx.fillRect(centerX, centerY, width, height);

    ctx.strokeStyle = "#000000";
    width = 85 * gameConfig.scaleFactor;
    ctx.strokeRect(centerX, centerY, width, height);
    ctx.closePath();
  }
};
function drawObjs(){
  // var objGoldImgData, objJewelImgData, objSkillFireImgData, objSkillFrostImgData, objSkillArcaneImgData;

  for(var i=0; i<Manager.objGolds.length; i++){
    var posX = util.worldXCoordToLocalX(Manager.objGolds[i].pos.x, gameConfig.userOffset.x, gameConfig.scaleFactor);
    var posY = util.worldYCoordToLocalY(Manager.objGolds[i].pos.y, gameConfig.userOffset.y, gameConfig.scaleFactor);
    var radius = Manager.objGolds[i].rad * 2 * gameConfig.scaleFactor;
    if(util.isObjInCanvas({x : posX, y : posY}, radius, gameConfig)){
      ctx.drawImage(resourceObject, objGoldImgData.srcPosX, objGoldImgData.srcPosY, objGoldImgData.srcWidth, objGoldImgData.srcHeight, posX, posY, radius, radius);
    }
    // ctx.arc(centerX * gameConfig.scaleFactor, centerY * gameConfig.scaleFactor, Manager.objGolds[i].radius * gameConfig.scaleFactor, 0, 2 * Math.PI);
    // var pos = util.worldToLocalPosition(Manager.objSkills[i].position, gameConfig.userOffset);
    // ctx.fillRect(pos.x * gameConfig.scaleFactor, pos.y * gameConfig.scaleFactor, Manager.objSkills[i].radius * 2 * gameConfig.scaleFactor, Manager.objSkills[i].radius * 2 * gameConfig.scaleFactor);
  }
  for(var i=0; i<Manager.objJewels.length; i++){
    posX = util.worldXCoordToLocalX(Manager.objJewels[i].pos.x, gameConfig.userOffset.x, gameConfig.scaleFactor);
    posY = util.worldYCoordToLocalY(Manager.objJewels[i].pos.y, gameConfig.userOffset.y, gameConfig.scaleFactor);
    radius = gameConfig.OBJ_JEWEL_RADIUS * 2 * gameConfig.scaleFactor;
    // radius = Manager.objJewels[i].radius * 2 * gameConfig.scaleFactor;
    if(util.isObjInCanvas({x : posX, y : posY}, radius, gameConfig)){
      ctx.drawImage(resourceObject, objJewelImgData.srcPosX, objJewelImgData.srcPosY, objJewelImgData.srcWidth, objJewelImgData.srcHeight, posX, posY, radius, radius);
    }
    // ctx.arc(centerX * gameConfig.scaleFactor, centerY * gameConfig.scaleFactor, Manager.objJewels[i].radius * gameConfig.scaleFactor, 0, 2 * Math.PI);
    // var pos = util.worldToLocalPosition(Manager.objSkills[i].position, gameConfig.userOffset);
    // ctx.fillRect(pos.x * gameConfig.scaleFactor, pos.y * gameConfig.scaleFactor, Manager.objSkills[i].radius * 2 * gameConfig.scaleFactor, Manager.objSkills[i].radius * 2 * gameConfig.scaleFactor);
  }
  // for(var i=0; i<Manager.objExps.length; i++){
  //   ctx.beginPath();
  //   var centerX = util.worldXCoordToLocalX(Manager.objExps[i].position.x + Manager.objExps[i].radius, gameConfig.userOffset.x);
  //   var centerY = util.worldYCoordToLocalY(Manager.objExps[i].position.y + Manager.objExps[i].radius, gameConfig.userOffset.y);
  //   ctx.arc(centerX * gameConfig.scaleFactor, centerY * gameConfig.scaleFactor, Manager.objExps[i].radius * gameConfig.scaleFactor, 0, 2 * Math.PI);
  //   ctx.fill();
  //   // var pos = util.worldToLocalPosition(Manager.objExps[i].position, gameConfig.userOffset);
  //   // ctx.fillRect(pos.x * gameConfig.scaleFactor, pos.y * gameConfig.scaleFactor, Manager.objExps[i].radius * 2 * gameConfig.scaleFactor, Manager.objExps[i].radius * 2 * gameConfig.scaleFactor);
  //   ctx.closePath();
  // };
  for(var i=0; i<Manager.objBoxs.length; i++){
    posX = util.worldXCoordToLocalX(Manager.objBoxs[i].pos.x, gameConfig.userOffset.x, gameConfig.scaleFactor);
    posY = util.worldYCoordToLocalY(Manager.objBoxs[i].pos.y, gameConfig.userOffset.y, gameConfig.scaleFactor);
    radius = gameConfig.OBJ_BOX_RADIUS * 2 * gameConfig.scaleFactor;
    // radius = Manager.objBoxs[i].radius * 2 * gameConfig.scaleFactor;
    if(util.isObjInCanvas({x : posX, y : posY}, radius, gameConfig)){
      ctx.drawImage(resourceObject, objBoxImgData.srcPosX, objBoxImgData.srcPosY, objBoxImgData.srcWidth, objBoxImgData.srcHeight, posX, posY, radius, radius);
    }
  }
  for(var i=0; i<Manager.objSkills.length; i++){
    posX = util.worldXCoordToLocalX(Manager.objSkills[i].pos.x, gameConfig.userOffset.x, gameConfig.scaleFactor);
    posY = util.worldYCoordToLocalY(Manager.objSkills[i].pos.y, gameConfig.userOffset.y, gameConfig.scaleFactor);
    radius = gameConfig.OBJ_SKILL_RADIUS * 2 * gameConfig.scaleFactor;

    switch (Manager.objSkills[i].pro) {
      case gameConfig.SKILL_PROPERTY_FIRE:
        var skillImgData = objSkillFireImgData;
        break;
      case gameConfig.SKILL_PROPERTY_FROST:
        skillImgData = objSkillFrostImgData;
        break;
      case gameConfig.SKILL_PROPERTY_ARCANE:
        skillImgData = objSkillArcaneImgData;
        break;
      default:
    }
    ctx.drawImage(resourceObject, skillImgData.srcPosX, skillImgData.srcPosY, skillImgData.srcWidth, skillImgData.srcHeight, posX, posY, radius, radius);
    // ctx.arc(centerX * gameConfig.scaleFactor, centerY * gameConfig.scaleFactor, Manager.objSkills[i].radius * gameConfig.scaleFactor, 0, 2 * Math.PI);
    // var pos = util.worldToLocalPosition(Manager.objSkills[i].position, gameConfig.userOffset);
    // ctx.fillRect(pos.x * gameConfig.scaleFactor, pos.y * gameConfig.scaleFactor, Manager.objSkills[i].radius * 2 * gameConfig.scaleFactor, Manager.objSkills[i].radius * 2 * gameConfig.scaleFactor);
  }
  for(var i=0; i<Manager.objBuffs.length; i++){
    posX = util.worldXCoordToLocalX(Manager.objBuffs[i].pos.x, gameConfig.userOffset.x, gameConfig.scaleFactor);
    posY = util.worldYCoordToLocalY(Manager.objBuffs[i].pos.y, gameConfig.userOffset.y, gameConfig.scaleFactor);
    radius = gameConfig.OBJ_BUFF_RADIUS * 2 * gameConfig.scaleFactor;
    // radius = Manager.objBuffs[i].radius * 2 * gameConfig.scaleFactor;
    // radius = gameConfig.OBJ_BUFF_RADIUS * 2 * gameConfig.scaleFactor;
    if(util.isObjInCanvas({x : posX, y : posY}, radius, gameConfig)){
      ctx.drawImage(resourceObject, Manager.objBuffs[i].resourceData.srcPosX, Manager.objBuffs[i].resourceData.srcPosY,
                    Manager.objBuffs[i].resourceData.srcWidth, Manager.objBuffs[i].resourceData.srcHeight,
                    posX, posY, radius, radius);
    }
  }
};
function drawUserEffect(){
  for(var i=0; i<Manager.userEffects.length; i++){
    var imgData = Manager.userEffects[i]['resourceIndex' + (Manager.userEffects[i].effectIndex + 1)];
    var center = util.worldToLocalPosition(Manager.userEffects[i].center, gameConfig.userOffset, gameConfig.scaleFactor);
    ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
                  center.x - (imgData.width/2) * gameConfig.scaleFactor, center.y - (imgData.height/2) * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
  }
};
function drawUsers(users){
  for(var k=0; k<users.length; k++){
    // var center = util.worldToLocalPosition(users[k].center, gameConfig.userOffset, gameConfig.scaleFactor);
    var center = users[k].localCenter;
  // for(var index in Manager.users){
    ctx.save();
    var radian = users[k].direction * radianFactor;
    ctx.translate(center.x, center.y);
    ctx.rotate(radian);
    //draw passive and buff effect
    for(var i=0; i<users[k].buffImgDataList.length; i++){
      if(!users[k].buffImgDataList[i].isFront){
        if(users[k].buffImgDataList[i].isAttach){
          var imgIndex = users[k].effectIndex % users[k].buffImgDataList[i].resourceLength + 1;
          var imgData = users[k].buffImgDataList[i]['resourceIndex' + imgIndex];
          if(users[k].buffImgDataList[i].isRotate){
            ctx.restore();
            ctx.save();
            ctx.translate(center.x, center.y);
            var effectRadian = (users[k].buffImgDataList[i].rotateStartDegree + users[k].effectRotateDegree) * radianFactor;
            ctx.rotate(effectRadian);
            ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
              -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
            ctx.restore();
            ctx.save();
            ctx.translate(center.x, center.y);
            ctx.rotate(radian);
          }else{
            ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
              -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
          }
        }
      }
    }
    //draw Hand
    var imgData = userHandImgData[users[k].imgHandIndex];
    ctx.drawImage(resourceCharacter, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
      -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
    //draw body
    ctx.drawImage(resourceCharacter, users[k].imgData.srcPosX, users[k].imgData.srcPosY, users[k].imgData.srcWidth, users[k].imgData.srcHeight,
      -users[k].imgData.width/2 * gameConfig.scaleFactor, -users[k].imgData.height/2 * gameConfig.scaleFactor, users[k].imgData.width *gameConfig.scaleFactor, users[k].imgData.height * gameConfig.scaleFactor);

      // draw cast effect
    if(users[k].skillCastEffectPlay){
      // ctx.fillStyle ="#00ff00";
      if(users[k].currentSkill){
        switch (users[k].currentSkill) {
          case gameConfig.SKILL_PROPERTY_FIRE:
            var imgData = castFireImgData;
            break;
          case gameConfig.SKILL_PROPERTY_FROST:
            imgData = castFrostImgData;
            break;
          case gameConfig.SKILL_PROPERTY_ARCANE:
            imgData = castArcaneImgData;
            break;
        }
        var scaleFactor = users[k].castEffectFactor;
        ctx.drawImage(resourceCharacter, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
          -imgData.width/2 * gameConfig.scaleFactor * scaleFactor, -imgData.height/2 * gameConfig.scaleFactor * scaleFactor, imgData.width * gameConfig.scaleFactor * scaleFactor, imgData.height * gameConfig.scaleFactor * scaleFactor);
      }
    }
    for(var i=0; i<users[k].hitImgDataList.length; i++){
      if(users[k].hitImgDataList[i].isAttach){
        var imgIndex = users[k].effectIndex % users[k].hitImgDataList[i].resourceLength + 1;
        var imgData = users[k].hitImgDataList[i]['resourceIndex' + imgIndex];
        if(users[k].hitImgDataList[i].isRotate){
          ctx.restore();
          ctx.save();
          ctx.translate(center.x, center.y);
          var effectRadian = (users[k].hitImgDataList[i].rotateStartDegree + users[k].effectRotateDegree) * radianFactor;
          ctx.rotate(effectRadian);
          ctx.drawImage(resourceCharacter, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
            -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
          ctx.restore();
          ctx.save();
          ctx.translate(center.x, center.y);
          ctx.rotate(radian);
        }else{
          ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
            -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
        }
      }
    }
    for(var i=0; i<users[k].buffImgDataList.length; i++){
      if(users[k].buffImgDataList[i].isFront){
        if(users[k].buffImgDataList[i].isAttach){
          var imgIndex = users[k].effectIndex % users[k].buffImgDataList[i].resourceLength + 1;
          var imgData = users[k].buffImgDataList[i]['resourceIndex' + imgIndex];
          if(users[k].buffImgDataList[i].isRotate){
            ctx.restore();
            ctx.save();
            ctx.translate(center.x, center.y);
            var effectRadian = (users[k].effectRotateDegree) * radianFactor;
            ctx.rotate(effectRadian);
            ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
              -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
            ctx.restore();
            ctx.save();
            ctx.translate(center.x, center.y);
            ctx.rotate(radian);
          }else{
            ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
              -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
          }
        }
      }
    }
    ctx.restore();

    //draw rankIcon
    //check isRanker
    // var pos = util.worldToLocalPosition(users[k].position, gameConfig.userOffset, gameConfig.scaleFactor);
    var pos = users[k].localPosition;
    var rank = false;
    for(var i=0; i<rankers.length; i++){
      if(rankers[i] === users[k].objectID){
        rank = i + 1;
      }
    }
    var rankImgData = undefined;
    if(rank){
      switch (rank) {
        case 1:
          rankImgData = rank1ImgData;
          break;
        case 2:
          rankImgData = rank2ImgData;
          break;
        case 3:
          rankImgData = rank3ImgData;
          break;
      }
      ctx.drawImage(resourceCharacter, rankImgData.srcPosX, rankImgData.srcPosY, rankImgData.srcWidth, rankImgData.srcHeight,
                    center.x - 15 * gameConfig.scaleFactor, center.y - 90 * gameConfig.scaleFactor, 30 * gameConfig.scaleFactor, 30* gameConfig.scaleFactor);
    }

    //draw User Level and Name
    ctx.drawImage(users[k].textCanvas, center.x - 200 * users[k].textScaleFactor, pos.y - 65 * users[k].textScaleFactor);
    // ctx.beginPath();
    // ctx.textAlign = "center";
    // ctx.fillStyle = "black";
    // ctx.font = "bold 15px Arial";
    // ctx.fillText("Lv." + users[k].level + " " + users[k].name, center.x, pos.y - 15 * gameConfig.scaleFactor);
    // ctx.closePath();

    if(users[k].HP !== users[k].maxHP || users[k].MP !== users[k].maxMP){
      //draw HP, MP gauge
      ctx.beginPath();
      // var pos = util.worldToLocalPosition(Manager.users[index].position, gameConfig.userOffset, gameConfig.scaleFactor);

      ctx.fillStyle = "#ff0000";
      var posX = pos.x - 7 * gameConfig.scaleFactor;
      var width = users[k].HP / users[k].maxHP * 78 * gameConfig.scaleFactor;
      var height = 7 * gameConfig.scaleFactor;
      ctx.fillRect(posX, pos.y + 80 * gameConfig.scaleFactor, width, height);

      ctx.fillStyle = "#0000ff";
      width = users[k].MP / users[k].maxMP * 78 * gameConfig.scaleFactor;
      height = 4 * gameConfig.scaleFactor;
      ctx.fillRect(posX, pos.y + 87 * gameConfig.scaleFactor, width, height);

      ctx.strokeStyle = "rgb(15,15,15)";
      width = 78 * gameConfig.scaleFactor;
      height = 10 * gameConfig.scaleFactor;
      ctx.lineJoin = "round";

      ctx.fillRect(posX, pos.y + 86.25 * gameConfig.scaleFactor, width, 0.75);
      // ctx.moveTo((pos.x - 8) * gameConfig.scaleFactor, (pos.y + 86) * gameConfig.scaleFactor);
      // ctx.lineTo((pos.x + 73) * gameConfig.scaleFactor, (pos.y + 86) * gameConfig.scaleFactor);
      // ctx.stroke();
      // var lineJoin = ['round','bevel','miter'];
      ctx.strokeRect(posX, pos.y + 80 * gameConfig.scaleFactor, width, height);
      ctx.closePath();
    }
  }
  // ctx.globalAlpha = 1;
};
function drawUserChat(users){
  // for(var index in Manager.users){
  for(var k=0; k<users.length; k++){
    var center = users[k].localCenter;
    var pos = users[k].localPosition;
    // var center = util.worldToLocalPosition(users[k].center, gameConfig.userOffset, gameConfig.scaleFactor);
    // var pos = util.worldToLocalPosition(users[k].position, gameConfig.userOffset, gameConfig.scaleFactor);
    if(users[k].chatMessage2){
      ctx.beginPath();
      ctx.textAlign = "center";
      ctx.font = "20px normal";
      ctx.strokeStyle = "#000000";

      var width = (users[k].chatMessage1.length * 12 + 20) * gameConfig.scaleFactor;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(center.x - width/2, pos.y - 55 * gameConfig.scaleFactor, width, 25 * gameConfig.scaleFactor);
      ctx.strokeRect(center.x - width/2, pos.y - 55 * gameConfig.scaleFactor, width, 25 * gameConfig.scaleFactor);
      ctx.fillStyle = "#000000";
      ctx.fillText(users[k].chatMessage1, center.x, pos.y - 36 * gameConfig.scaleFactor);

      width = (users[k].chatMessage2.length * 12 + 20) * gameConfig.scaleFactor;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(center.x - width/2, pos.y - 30 * gameConfig.scaleFactor, width, 25 * gameConfig.scaleFactor);
      ctx.strokeRect(center.x - width/2, pos.y - 30 * gameConfig.scaleFactor, width, 25 * gameConfig.scaleFactor);
      ctx.fillStyle = "#000000";
      ctx.fillText(users[k].chatMessage2, center.x, pos.y - 11 * gameConfig.scaleFactor);

      ctx.moveTo(center.x - 8, pos.y - 5 * gameConfig.scaleFactor);
      ctx.lineTo(center.x + 8, pos.y - 5 * gameConfig.scaleFactor);
      ctx.lineTo(center.x, pos.y);
      ctx.fill();

      ctx.closePath();
    }else if(users[k].chatMessage1){
      ctx.beginPath();
      var width = (users[k].chatMessage1.length * 12 + 20) * gameConfig.scaleFactor;
      ctx.strokeStyle = "#000000";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(center.x - width/2, pos.y - 30 * gameConfig.scaleFactor, width, 25 * gameConfig.scaleFactor);
      ctx.strokeRect(center.x - width/2, pos.y - 30 * gameConfig.scaleFactor, width, 25 * gameConfig.scaleFactor);
      ctx.fillStyle = "#000000";
      ctx.moveTo(center.x - 8, pos.y - 5 * gameConfig.scaleFactor);
      ctx.lineTo(center.x + 8, pos.y - 5 * gameConfig.scaleFactor);
      ctx.lineTo(center.x, pos.y);
      ctx.fill();

      ctx.textAlign = "center";
      ctx.font = "20px normal";
      ctx.fillText(users[k].chatMessage1, center.x, pos.y - 11 * gameConfig.scaleFactor);

      ctx.closePath();
    }
  }
}
function drawMobs(mobs){
  for(var i=0; i<mobs.length; i++){
    var center = mobs[i].localCenter;

    ctx.save();
    var radian = mobs[i].direction * radianFactor;
    ctx.translate(center.x, center.y);
    ctx.rotate(radian);

    for(var j=0; j<mobs[i].buffImgDataList.length; j++){
      if(!mobs[i].buffImgDataList[j].isFront){
        if(mobs[i].buffImgDataList[j].isAttach){
          var imgIndex = mobs[i].effectIndex % mobs[i].buffImgDataList[j].resourceLength + 1;
          var imgData = mobs[i].buffImgDataList[j]['resourceIndex' + imgIndex];
          if(mobs[i].buffImgDataList[j].isRotate){
            ctx.restore();
            ctx.save();
            ctx.translate(center.x, center.y);
            var effectRadian = (mobs[i].buffImgDataList[j].rotateStartDegree + mobs[i].effectRotateDegree) * radianFactor;
            ctx.rotate(effectRadian);
            ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
              -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
            ctx.restore();
            ctx.save();
            ctx.translate(center.x, center.y);
            ctx.rotate(radian);
          }else{
            ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
              -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
          }
        }
      }
    }

    ctx.drawImage(resourceCharacter, mobs[i].imgData.srcPosX, mobs[i].imgData.srcPosY, mobs[i].imgData.srcWidth, mobs[i].imgData.srcHeight,
                  -mobs[i].imgData.width/2 * gameConfig.scaleFactor, -mobs[i].imgData.height/2 * gameConfig.scaleFactor, mobs[i].imgData.width * gameConfig.scaleFactor, mobs[i].imgData.height * gameConfig.scaleFactor);

    for(var j=0; j<mobs[i].hitImgDataList.length; j++){
      if(mobs[i].hitImgDataList[j].isAttach){
        var imgIndex = mobs[i].effectIndex % mobs[i].hitImgDataList[j].resourceLength + 1;
        var imgData = mobs[i].hitImgDataList[j]['resourceIndex' + imgIndex];
        if(mobs[i].hitImgDataList[j].isRotate){
          ctx.restore();
          ctx.save();
          ctx.translate(center.x, center.y);
          var effectRadian = (mobs[i].hitImgDataList[j].rotateStartDegree + mobs[i].effectRotateDegree) * radianFactor;
          ctx.rotate(effectRadian);
          ctx.drawImage(resourceCharacter, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
            -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
          ctx.restore();
          ctx.save();
          ctx.translate(center.x, center.y);
          ctx.rotate(radian);
        }else{
          ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
            -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
        }
      }
    }
    for(var j=0; j<mobs[i].buffImgDataList.length; j++){
      if(mobs[i].buffImgDataList[j].isFront){
        if(mobs[i].buffImgDataList[j].isAttach){
          var imgIndex = mobs[i].effectIndex % mobs[i].buffImgDataList[j].resourceLength + 1;
          var imgData = mobs[i].buffImgDataList[j]['resourceIndex' + imgIndex];
          if(mobs[i].buffImgDataList[j].isRotate){
            ctx.restore();
            ctx.save();
            ctx.translate(center.x, center.y);
            var effectRadian = (mobs[i].effectRotateDegree) * radianFactor;
            ctx.rotate(effectRadian);
            ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
              -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
            ctx.restore();
            ctx.save();
            ctx.translate(center.x, center.y);
            ctx.rotate(radian);
          }else{
            ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
              -imgData.width/2 * gameConfig.scaleFactor, -imgData.height/2 * gameConfig.scaleFactor, imgData.width * gameConfig.scaleFactor, imgData.height * gameConfig.scaleFactor);
          }
        }
      }
    }
    ctx.restore();

    if(mobs[i].HP !== mobs[i].maxHP){
      //draw HP gauge
      var pos = mobs[i].localPosition;
      ctx.beginPath();
      ctx.fillStyle = "#ff0000";
      var posX = pos.x - 7 * gameConfig.scaleFactor;
      var width = mobs[i].HP / mobs[i].maxHP * 60 * gameConfig.scaleFactor;
      var height = 7 * gameConfig.scaleFactor;
      ctx.fillRect(posX, pos.y + 60 * gameConfig.scaleFactor, width, height);

      ctx.strokeStyle = "rgb(15,15,15)";
      width = 60 * gameConfig.scaleFactor;
      ctx.lineJoin = "round";
      ctx.strokeRect(posX, pos.y + 60 * gameConfig.scaleFactor, width, height);
      ctx.closePath();
    }
  }
}
function drawEffect(){
  for(var i=0; i<Manager.effects.length; i++){
    ctx.beginPath();
    ctx.fillStyle ="#ff0000";
    if(Manager.effects[i].effectImgData){
      var imgData = Manager.effects[i].effectImgData['resourceIndex1'];
      // var isRotate = Manager.effects[i].effectImgData.isRotate;
    }else{
      switch (Manager.effects[i].property) {
        case gameConfig.SKILL_PROPERTY_FIRE:
        imgData = skillFireImgData;
        break;
        case gameConfig.SKILL_PROPERTY_FROST:
        imgData = skillFrostImgData;
        break;
        case gameConfig.SKILL_PROPERTY_ARCANE:
        imgData = skillArcaneImgData;
        break;
        default:
      }
    }
    var centerX = util.worldXCoordToLocalX(Manager.effects[i].position.x + Manager.effects[i].radius, gameConfig.userOffset.x, gameConfig.scaleFactor);
    var centerY = util.worldYCoordToLocalY(Manager.effects[i].position.y + Manager.effects[i].radius, gameConfig.userOffset.y, gameConfig.scaleFactor);
    // var radius = Manager.effects[i].radius;
    var radius = Manager.effects[i].radius * Manager.effects[i].scaleFactor;
    // var posX = util.worldXCoordToLocalX(Manager.effects[i].position.x, gameConfig.userOffset.x);
    // var posY = util.worldYCoordToLocalY(Manager.effects[i].position.y, gameConfig.userOffset.y);
    ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
                  centerX - radius, centerY - radius, radius * 2, radius * 2);
    // var centerX = util.worldXCoordToLocalX(Manager.effects[i].position.x + Manager.effects[i].radius, gameConfig.userOffset.x);
    // var centerY = util.worldYCoordToLocalY(Manager.effects[i].position.y + Manager.effects[i].radius, gameConfig.userOffset.y);
    // ctx.arc(centerX * gameConfig.scaleFactor, centerY * gameConfig.scaleFactor, Manager.effects[i].radius * gameConfig.scaleFactor, 0, Math.PI * 2);
    // ctx.fill();

    ctx.closePath();
  }
};
function drawProjectile(){
  for(var i=0; i<Manager.projectiles.length; i++){
    // ctx.arc(centerX * gameConfig.scaleFactor, centerY * gameConfig.scaleFactor, Manager.projectiles[i].radius * gameConfig.scaleFactor, 0, Math.PI * 2);
    if(Manager.projectiles[i].projectileImgData){
      var imgData = Manager.projectiles[i].projectileImgData['resourceIndex1'];
      var isRotate = Manager.projectiles[i].projectileImgData.isRotate;
    }else{
      switch (Manager.projectiles[i].property) {
        case gameConfig.SKILL_PROPERTY_FIRE:
        imgData = projectileFireImgData;
        break;
        case gameConfig.SKILL_PROPERTY_FROST:
        imgData = projectileFrostImgData;
        break;
        case gameConfig.SKILL_PROPERTY_ARCANE:
        imgData = projectileArcaneImgData;
        break;
        default:
      }
    }
    var posX = util.worldXCoordToLocalX(Manager.projectiles[i].position.x, gameConfig.userOffset.x, gameConfig.scaleFactor);
    var posY = util.worldYCoordToLocalY(Manager.projectiles[i].position.y, gameConfig.userOffset.y, gameConfig.scaleFactor);
    var radius = Manager.projectiles[i].radius *  gameConfig.scaleFactor;
    if(isRotate){
      var centerX = posX + radius;
      var centerY = posY + radius;
      ctx.save();
      ctx.translate(centerX, centerY);
      var effectRadian = (Manager.projectiles[i].effectRotateDegree) * radianFactor;
      ctx.rotate(effectRadian);
      ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
        -radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }else{
      ctx.drawImage(resourceSkillEffect, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
        posX, posY, radius * 2, radius * 2);
    }
  }
};
// function drawRiseText(){
//   for(var i=0; i<Manager.riseText.length; i++){
//     ctx.font = "30px Arial";
//     ctx.fillStyle = Manager.riseText[i].color;
//     // console.log(Manager.riseText[i].position);
//     var pos = util.worldToLocalPosition(Manager.riseText[i].position, gameConfig.userOffset, gameConfig.scaleFactor);
//     ctx.fillText(Manager.riseText[i].text, pos.x, pos.y);
//   }
// };
function drawSkillRange(){
  if(currentSkillData.type === gameConfig.SKILL_TYPE_PROJECTILE || currentSkillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK ||
     currentSkillData.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION || currentSkillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION){

     ctx.beginPath();
     ctx.save();
     var center = util.worldToLocalPosition(Manager.users[gameConfig.userID].center, gameConfig.userOffset);
     var distX = mousePoint.x - center.x;
     var distY = mousePoint.y - center.y;

     var radian = Math.atan(distY / distX);
     if(isNaN(radian)){
      radian = 0;
     }else{
       if(distX < 0 && distY >= 0){
         radian += Math.PI;
       }else if(distX < 0 && distY < 0){
         radian -= Math.PI;
       }
     }

     ctx.translate(center.x * gameConfig.scaleFactor, center.y * gameConfig.scaleFactor);
     ctx.rotate(radian);
     ctx.drawImage(resourceCharacter, projectileSkillArrowImgData.srcPosX, projectileSkillArrowImgData.srcPosY, projectileSkillArrowImgData.srcWidth, projectileSkillArrowImgData.srcHeight,
                   -projectileSkillArrowImgData.width/2 * gameConfig.scaleFactor, -projectileSkillArrowImgData.height/2 * gameConfig.scaleFactor, projectileSkillArrowImgData.width *gameConfig.scaleFactor, projectileSkillArrowImgData.height * gameConfig.scaleFactor);
     ctx.closePath();
     ctx.restore();
   }else if(currentSkillData.index === baseSkill){
     ctx.beginPath();
     ctx.fillStyle = "#ffffff";
     ctx.globalAlpha = 0.7;
     ctx.arc(mousePoint.x * gameConfig.scaleFactor, mousePoint.y * gameConfig.scaleFactor, currentSkillData.explosionRadius * gameConfig.scaleFactor, 0, Math.PI * 2);
     ctx.fill();
     ctx.closePath();
   }else{
     ctx.beginPath();
     ctx.fillStyle = "#ffffff";
     ctx.globalAlpha = 0.5;
     var center = util.worldToLocalPosition(Manager.users[gameConfig.userID].center, gameConfig.userOffset);
     ctx.arc(center.x * gameConfig.scaleFactor, center.y * gameConfig.scaleFactor, currentSkillData.range * gameConfig.scaleFactor, 0, 2 * Math.PI);
     ctx.fill();
     ctx.closePath();
     //draw explosionRadius
     ctx.beginPath();
     ctx.globalAlpha = 0.7;

     var distSquare = util.distanceSquare(center, mousePoint);
     if(Math.pow(currentSkillData.range,2) > distSquare){
       ctx.arc(mousePoint.x * gameConfig.scaleFactor, mousePoint.y * gameConfig.scaleFactor, currentSkillData.explosionRadius * gameConfig.scaleFactor, 0, Math.PI * 2);
     }else{
       var distX = mousePoint.x - center.x;
       var distY = mousePoint.y - center.y;

       var radian = Math.atan(distY / distX);
       if(isNaN(radian)){
        radian = 0;
       }else{
         if(distX < 0 && distY >= 0){
           radian += Math.PI;
         }else if(distX < 0 && distY < 0){
           radian -= Math.PI;
         }
       }

       var addPosX = currentSkillData.range * Math.cos(radian);
       var addPosY = currentSkillData.range * Math.sin(radian);

       var drawCenter = {x : center.x + addPosX, y : center.y + addPosY};
       ctx.arc(drawCenter.x * gameConfig.scaleFactor, drawCenter.y * gameConfig.scaleFactor, currentSkillData.explosionRadius * gameConfig.scaleFactor, 0, Math.PI * 2);
     }
     ctx.fill();
   }
   ctx.globalAlpha = 1
};
function drawBackground(){
  if(gameConfig.userOffset.x <= 200 || gameConfig.userOffset.y <= 200 ||
     gameConfig.userOffset.x >= gameConfig.CANVAS_MAX_SIZE.width - 200 - gameConfig.CANVAS_MAX_LOCAL_SIZE.width ||
     gameConfig.userOffset.y >= gameConfig.CANVAS_MAX_SIZE.height - 200 - gameConfig.CANVAS_MAX_LOCAL_SIZE.height){
    ctx.fillStyle = "rgb(96, 56, 19)";
    var posX = -gameConfig.userOffset.x * gameConfig.scaleFactor;
    var posY = -gameConfig.userOffset.y * gameConfig.scaleFactor;
    var sizeW = gameConfig.CANVAS_MAX_SIZE.width * gameConfig.scaleFactor;
    var sizeH = gameConfig.CANVAS_MAX_SIZE.height * gameConfig.scaleFactor;
    ctx.fillRect(posX, posY, sizeW, sizeH);
  }

  ctx.fillStyle = "rgb(105, 147, 50)";
  posX = (-gameConfig.userOffset.x + 100) * gameConfig.scaleFactor;
  posY = (-gameConfig.userOffset.y + 100) * gameConfig.scaleFactor;
  sizeW = (gameConfig.CANVAS_MAX_SIZE.width - 200)* gameConfig.scaleFactor;
  sizeH = (gameConfig.CANVAS_MAX_SIZE.height - 200) * gameConfig.scaleFactor;
  ctx.fillRect(posX, posY, sizeW, sizeH);
};
function drawGrid(){
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgb(103, 124, 81)';
  ctx.beginPath();
  for(var x = - gameConfig.userOffset.x - 800; x<gameConfig.canvasSize.width; x += 50){
    var scaledX = x * gameConfig.scaleFactor;
    if(util.isXInCanvas(scaledX, gameConfig)){
      ctx.moveTo(scaledX, 0);
      ctx.lineTo(scaledX, gameConfig.canvasSize.height);
    }
  }
  for(var y = - gameConfig.userOffset.y - 500; y<gameConfig.canvasSize.height; y += 50){
    var scaledY = y * gameConfig.scaleFactor;
    if(util.isYInCanvas(scaledY, gameConfig)){
      ctx.moveTo(0, scaledY);
      ctx.lineTo(gameConfig.canvasSize.width, scaledY);
    }
  }
  ctx.stroke();
  // ctx.globalAlpha = 1;
  ctx.closePath();
};
function drawImmortalZone(){
  for(var i=0; i<Manager.immortalGrounds.length; i++){
    var center = util.worldToLocalPosition(Manager.immortalGrounds[i].center, gameConfig.userOffset, gameConfig.scaleFactor);
    if(util.isObjInCanvas(center, Manager.immortalGrounds[i].size.width/2, gameConfig)){
      ctx.drawImage(resourceEnvironment, Manager.immortalGrounds[i].imgData.srcPosX, Manager.immortalGrounds[i].imgData.srcPosY, Manager.immortalGrounds[i].imgData.srcWidth, Manager.immortalGrounds[i].imgData.srcHeight,
                    center.x - (Manager.immortalGrounds[i].size.width/2) * gameConfig.scaleFactor, center.y - (Manager.immortalGrounds[i].size.height/2) * gameConfig.scaleFactor, Manager.immortalGrounds[i].size.width * gameConfig.scaleFactor, Manager.immortalGrounds[i].size.height * gameConfig.scaleFactor);
    }
  }
}
function drawPortalZone(){
  for(var i=0; i<Manager.portals.length; i++){
    var center = util.worldToLocalPosition(Manager.portals[i].center, gameConfig.userOffset, gameConfig.scaleFactor);
    var imgData = portalImgData[portalImgIndex];
    if(util.isObjInCanvas(center, Manager.portals[i].size.width/2, gameConfig)){
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(portalRotateDegree * radianFactor);
      ctx.drawImage(resourceEnvironment, imgData.srcPosX, imgData.srcPosY, imgData.srcWidth, imgData.srcHeight,
                    -(Manager.portals[i].size.width/2) * gameConfig.scaleFactor, -(Manager.portals[i].size.height/2) * gameConfig.scaleFactor, Manager.portals[i].size.width * gameConfig.scaleFactor, Manager.portals[i].size.height * gameConfig.scaleFactor);
      // ctx.drawImage(resourceEnvironment, Manager.portals[i].imgData.srcPosX, Manager.portals[i].imgData.srcPosY, Manager.portals[i].imgData.srcWidth, Manager.portals[i].imgData.srcHeight,
      //               center.x - (Manager.portals[i].size.width/2) * gameConfig.scaleFactor, center.y - (Manager.portals[i].size.height/2) * gameConfig.scaleFactor, Manager.portals[i].size.width * gameConfig.scaleFactor, Manager.portals[i].size.height * gameConfig.scaleFactor);
      ctx.restore();

      ctx.drawImage(portalCacheCanvas, center.x - 100, center.y - 70);
    }
  }
  if(Date.now() - portalImgChangeTime > 100){
    portalImgChangeTime = Date.now();
    if(isUpPortalImgIndex){
      if(portalImgIndex >= 4){
        portalImgIndex = 3;
        isUpPortalImgIndex = false;
      }else{
        portalImgIndex ++;
      }
    }else{
      if(portalImgIndex <= 0){
        portalImgIndex = 1;
        isUpPortalImgIndex = true;
      }else{
        portalImgIndex --;
      }
    }
    portalRotateDegree++;
  }
}
function updateUserDataHandler(){
  var userData = Manager.processUserData();
  var needInform = false;
  if(Date.now() - userDataLastUpdateTime >= 1000){
    needInform = true;
    userDataLastUpdateTime = Date.now();
  }
  if(Date.now() - userPingCheckTime >= 5000){
    userPingCheckTime = Date.now();
    socket.emit(gameConfig.MTYPE_FIRE_PING, userPingCheckTime);
  }
  socket.emit(gameConfig.MTYPE_USER_DATA_UPDATE, userData, needInform, frameCounter.lastFrameCount);
};
function canvasAddEvent(){
  canvas.addEventListener('click', canvasEventHandler, false);
  canvas.addEventListener('mousemove', mouseMoveHandler, false);
  canvas.addEventListener('mousedown', mouseDownHandler, false);
  canvas.addEventListener('mouseup', mouseUpHandler, false);
};
function documentAddEvent(){
  document.addEventListener('keydown', documentKeyDownEventHandler, false);
};
function canvasDisableEvent(){
  canvas.removeEventListener('click', canvasEventHandler);
  canvas.removeEventListener('mousemove', mouseMoveHandler);
  canvas.removeEventListener('mousedown', mouseDownHandler);
  canvas.removeEventListener('mouseup', mouseUpHandler);
};
function documentDisableEvent(){
  document.removeEventListener('keydown', documentKeyDownEventHandler);
};
function mouseDownHandler(){
  continueMove = true;
};
function mouseUpHandler(){
  continueMove = false;
};
// var mouseMoveEventTimer = Date.now();
// var canvasMouseMoveEventHandler = function(e){
//   if(Date.now() - mouseMoveEventTimer >= 100){
//     mouseMoveEventTimer = Date.now();
//     mousePoint.x = e.clientX/gameConfig.scaleFactor;
//     mousePoint.y = e.clientY/gameConfig.scaleFactor;
//     var worldClickPosition = util.localToWorldPosition(mousePoint, gameConfig.userOffset);
//
//     if(drawMode === gameConfig.DRAW_MODE_NORMAL){
//       var targetPosition = util.setTargetPosition(worldClickPosition, Manager.users[gameConfig.userID]);
//       Manager.moveUser(targetPosition);
//
//       var userData = Manager.processUserData();
//       userData.targetPosition = targetPosition;
//       userDataLastUpdateTime = Date.now();
//       socket.emit('userMoveStart', userData);
//     }
//   }
// };
var canvasEventHandler = function(e){
  if(isChattingOn){
    isChattingOn = false;
    UIManager.disableChatInput();
  }

  userLastActionTime = Date.now();
  if(userCastingTimeHandler){
    clearTimeout(userCastingTimeHandler);
    userCastingTimeHandler = false;
  }
  var timeDelay = 0;
  if(Manager.user.castingEndTime){
    timeDelay = Manager.user.castingEndTime - Date.now() + 30;
  }

  userCastingTimeHandler = setTimeout(function(){
    var clickPosition ={
      x : e.clientX/gameConfig.scaleFactor,
      y : e.clientY/gameConfig.scaleFactor
    }
    var worldClickPosition = util.localToWorldPosition(clickPosition, gameConfig.userOffset);

    // if(drawMode === gameConfig.DRAW_MODE_NORMAL){
    //   if(Manager.users[gameConfig.userID]){
    //     var targetPosition = util.setTargetPosition(worldClickPosition, Manager.users[gameConfig.userID]);
    //     Manager.moveUser(targetPosition);
    //
    //     var userData = Manager.processUserData();
    //     userData.targetPosition = targetPosition;
    //     userDataLastUpdateTime = Date.now();
    //     socket.emit('userMoveStart', userData);
    //   }
    // }else
    if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
      if(currentSkillData.index === baseSkill){
        //case A
        var targetPosition = util.setMoveAttackUserTargetPosition(worldClickPosition, currentSkillData, Manager.users[gameConfig.userID]);
        var userTargetPosition = {x : Math.floor(targetPosition.x), y : Math.floor(targetPosition.y) };
        var skillData = objectAssign({}, currentSkillData);
        skillData.targetPosition = { x : Math.floor(worldClickPosition.x), y : Math.floor(worldClickPosition.y) };

        Manager.moveAndAttackUser(gameConfig.userID, userTargetPosition, skillData, targetPosition.moveBackward);

        var userData = Manager.processUserData();

        userData.targetPosition = userTargetPosition;
        userData.moveBackward = targetPosition.moveBackward;

        userData.skillIndex = currentSkillData.index;
        userData.skillTargetPosition = { x : Math.floor(worldClickPosition.x), y : Math.floor(worldClickPosition.y) };;

        changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
        userDataLastUpdateTime = Date.now();
        socket.emit(gameConfig.MTYPE_USER_MOVE_AND_ATTACK, userData);
      }else{
        useSkill(currentSkillData, worldClickPosition, Manager.users[gameConfig.userID]);
        changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
      }
    }
  }, timeDelay);
};
var documentKeyDownEventHandler = function(e){
  userLastActionTime = Date.now();
  var keyCode = e.keyCode || e.which || 0;
  if(drawMode === gameConfig.DRAW_MODE_NORMAL && !isChattingOn){
    if(keyCode === keySettings.BindingE || keyCode === keySettings.BindingSpace){
      // if(UIManager.checkCooltime(gameConfig.SKILL_BASIC_INDEX)){
      if(Manager.user.currentState !== gameConfig.OBJECT_STATE_ATTACK){
        var skillData = objectAssign({}, baseSkillData);
      }
      // }
    }else if(keyCode === keySettings.Binding1){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP1_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[0]);
      // }
    }else if(keyCode === keySettings.Binding2){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP2_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[1]);
      // }
    }else if(keyCode === keySettings.Binding3){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP3_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[2]);
      // }
    }else if(keyCode === keySettings.Binding4){
      // if(UIManager.checkCooltime(gameConfig.SKILL_EQUIP4_INDEX)){
      skillData = objectAssign({}, equipSkillDatas[3]);
      // }
    }
    checkSkillConditionAndUse(skillData);

    if(keyCode === keySettings.BindingA){
      //case A
      skillData = objectAssign({}, baseSkillData);
      checkBaseSkillCondition(skillData);
    }
  }
  if(keyCode === keySettings.BindingG){
    //case G
    if(!isChattingOn && !isOnField){
      UIManager.popChangeWithKey();
    }
  }

  if(keyCode === keySettings.BindingEsc){
    //case esc
    if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
      changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
    }
    if(isChattingOn){
      isChattingOn = false;
      UIManager.disableChatInput();
    }else{
      UIManager.popCloseWithKey();
    }
  }
  if(keyCode === keySettings.BindingS){
    //case s
    if(!isChattingOn){
      Manager.stopUser();
      var userData = Manager.processUserData();
      userDataLastUpdateTime = Date.now();
      socket.emit(gameConfig.MTYPE_USER_STOP, userData);
    }
  }
  //for chatting
  if(keyCode === keySettings.BindingEnter){
    if(!isChattingOn){
      isChattingOn = true;
      UIManager.showChatInput();
    }else{
      isChattingOn = false;
      var chatMessage = util.processMessage(UIManager.getChatMessage(), gameConfig.CHAT_MESSAGE_LENGTH, false);
      UIManager.disableChatInput();
      UIManager.clearChatInput();
      if(chatMessage){
        socket.emit(gameConfig.MTYPE_CHATTING, chatMessage);
      }
    }
  }
  // if(keyCode === 36) { //keySettings.BindingHome){
  //   //case HOME key
  //   if(currentLevel >= 1){
  //     socket.emit(gameConfig.MTYPE_KILL_ME);
  //   }else{
  //     UIManager.makeFlashMessage('Suicide is limited to level 15 or higher.');
  //   }
  // }
  // //
  // // cheatCode
  // if(keyCode === 33){
  //   //case Page Up
  //   socket.emit(gameConfig.MTYPE_GIVE_EXP);
  // }
  // if(keyCode === 45){
  //   //case Insert
  //   socket.emit(gameConfig.MTYPE_GIVE_RESOURCES);
  // }
  // if(keyCode === 46){
  //   //case Delete
  //   socket.emit(gameConfig.MTYPE_GIVE_ALL_SKILL);
  // }
};
function checkBaseSkillCondition(skillData){
  if(skillData.index === baseSkill){
    if(!Manager.user.conditions[gameConfig.USER_CONDITION_FREEZE] && !Manager.user.conditions[gameConfig.USER_CONDITION_SILENCE] && !Manager.user.conditions[gameConfig.USER_CONDITION_BLUR]){
      Manager.applyCastSpeed(gameConfig.userID, skillData);
      currentSkillData = skillData;
      changeDrawMode(gameConfig.DRAW_MODE_SKILL_RANGE);
    }
  }
}
function checkSkillConditionAndUse(skillData){
  if(userCastingTimeHandler){
    clearTimeout(userCastingTimeHandler);
    userCastingTimeHandler = false;
  }
  var timeDelay = 0;
  if(Manager.user.castingEndTime){
    timeDelay = Manager.user.castingEndTime - Date.now() + 30;
  }
  userCastingTimeHandler = setTimeout(function(){
    if(skillData && skillData.hasOwnProperty('index')){
      if(skillData.type !== gameConfig.SKILL_TYPE_PASSIVE){
        if(Manager.user.conditions[gameConfig.USER_CONDITION_FREEZE]){
          UIManager.makeFlashMessage('FROZEN!!!');
          if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
            changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
          }
        }else if(Manager.user.conditions[gameConfig.USER_CONDITION_SILENCE]){
          UIManager.makeFlashMessage('SILENCED!!!');
          if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
            changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
          }
        }else if(Manager.user.conditions[gameConfig.USER_CONDITION_BLUR]){
          UIManager.makeFlashMessage('Using Portal!!!')
          if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
            changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
          }
        }else if(Manager.user.MP < skillData.consumeMP){
          UIManager.makeFlashMessage('Not enough Mana!!!');
          if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
            changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
          }
        }else if(!UIManager.checkCooltime(skillData.index)){
          if(skillData.index !== baseSkill){
            UIManager.makeFlashMessage('Spell is not ready!!!');
            if(drawMode === gameConfig.DRAW_MODE_SKILL_RANGE){
              changeDrawMode(gameConfig.DRAW_MODE_NORMAL);
            }
          }
        }else{
          Manager.applyCastSpeed(gameConfig.userID, skillData);
          if(skillData.type === gameConfig.SKILL_TYPE_PROJECTILE || skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION
            || skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK || skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION
            || skillData.type === gameConfig.SKILL_TYPE_RANGE || skillData.type === gameConfig.SKILL_TYPE_TELEPORT){
              if(drawMode === gameConfig.DRAW_MODE_NORMAL){
                currentSkillData = skillData;
                changeDrawMode(gameConfig.DRAW_MODE_SKILL_RANGE);
              }
          }else{
            useSkill(skillData, Manager.users[gameConfig.userID].center, Manager.users[gameConfig.userID]);
          }
        }
      }
    }
  }, timeDelay);
};
function changeDrawMode(mode){
  if(mode === gameConfig.DRAW_MODE_NORMAL){
    drawMode = gameConfig.DRAW_MODE_NORMAL;
    currentSkillData = null;
    UIManager.disableSelectSkillInfo();
    // canvas.removeEventListener('mousemove', mouseMoveHandler);
  }else if(mode === gameConfig.DRAW_MODE_SKILL_RANGE){
    drawMode = gameConfig.DRAW_MODE_SKILL_RANGE;
    UIManager.enableSelectSkillInfo(currentSkillData);
    // canvas.onmousemove = mouseMoveHandler;
    // canvas.addEventListener('mousemove', mouseMoveHandler, false);
  }
};
function mouseMoveHandler(e){
  mousePoint.x = e.clientX/gameConfig.scaleFactor;
  mousePoint.y = e.clientY/gameConfig.scaleFactor;
};
function useSkill(skillData, clickPosition, user){
  if(UIManager.checkCooltime(skillData.index)){
    if(!user.conditions[gameConfig.USER_CONDITION_FREEZE] && !user.conditions[gameConfig.USER_CONDITION_SILENCE] && !user.conditions[gameConfig.USER_CONDITION_BLUR]){
      skillData.targetPosition = util.calcSkillTargetPosition(skillData, clickPosition, user);
      if(skillData.type === gameConfig.SKILL_TYPE_TELEPORT){
        var isCollision = true;
        var repeatCount = 1;
        while(isCollision){
          repeatCount++;
          var collisionObjs = Manager.checkCollisionWithObstacles(skillData.targetPosition, user);
          if(collisionObjs.length){
            skillData.targetPosition = Manager.reCalcSkillTargetPosition(skillData.targetPosition, user, collisionObjs);
          }else{
            isCollision = false;
          }
          if(repeatCount >= 20){
            isCollision = false;
          }
        }
      }
      skillData.direction = util.calcSkillTargetDirection(skillData.type, skillData.targetPosition, user);
      if(skillData.type === gameConfig.SKILL_TYPE_PROJECTILE || skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK ||
        skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_EXPLOSION || skillData.type === gameConfig.SKILL_TYPE_PROJECTILE_TICK_EXPLOSION
        || skillData.type === gameConfig.SKILL_TYPE_INSTANT_PROJECTILE){
          skillData.projectileIDs = util.generateRandomUniqueID(Manager.projectiles, gameConfig.PREFIX_SKILL_PROJECTILE, skillData.projectileCount);
      }
      Manager.useSkill(gameConfig.userID, skillData);

      var userData = Manager.processUserData();
      userData.skillIndex = skillData.index;
      userData.skillDirection = Math.floor(skillData.direction);
      userData.skillTargetPosition = {x : Math.floor(skillData.targetPosition.x), y : Math.floor(skillData.targetPosition.y) };
      if(skillData.projectileIDs){
        userData.projectileIDs = skillData.projectileIDs;
      }
      // if(user.conditions[gameConfig.USER_CONDITION_BLUR]){
      //   userData.cancelBlur = true;
      // }
      userDataLastUpdateTime = Date.now();
      socket.emit(gameConfig.MTYPE_USER_USE_SKILL, userData);
    }
  }
};
function updateCharTypeSkill(charType){
  switch (charType) {
    case gameConfig.CHAR_TYPE_FIRE:
      pyroBaseSkill = baseSkill;
      pyroInherentPassiveSkill = inherentPassiveSkill;
      for(var i=0; i<equipSkills.length; i++){
        pyroEquipSkills[i] = equipSkills[i];
      }
      break;
    case gameConfig.CHAR_TYPE_FROST:
      frosterBaseSkill = baseSkill;
      frosterInherentPassiveSkill = inherentPassiveSkill;
      for(var i=0; i<equipSkills.length; i++){
        frosterEquipSkills[i] = equipSkills[i];
      }
      break;
    case gameConfig.CHAR_TYPE_ARCANE:
      mysterBaseSkill = baseSkill;
      mysterInherentPassiveSkill = inherentPassiveSkill;
      for(var i=0; i<equipSkills.length; i++){
        mysterEquipSkills[i] = equipSkills[i];
      }
      break;
  }

  // update server equip skill
  socket.emit(gameConfig.MTYPE_UPDATE_EQUIP_SKILLS, charType, equipSkills);
};
function updateCharTypeLevel(){
  switch (characterType) {
    case gameConfig.CHAR_TYPE_FIRE:
      pyroLevel = currentLevel;
      break;
    case gameConfig.CHAR_TYPE_FROST:
      frosterLevel = currentLevel;
      break;
    case gameConfig.CHAR_TYPE_ARCANE:
      mysterLevel = currentLevel;
      break;
  }
  // //for reconnect char level
  // if(currentLevel < pyroLevel){
  //   currentLevel = pyroLevel;
  // }
  // if(currentLevel < frosterLevel){
  //   currentLevel = frosterLevel;
  // }
  // if(currentLevel < mysterLevel){
  //   currentLevel = mysterLevel;
  // }
};
function updateSkills(changeSkills){
  baseSkill = changeSkills.bS;
  inherentPassiveSkill = changeSkills.iPS;
  possessSkills = changeSkills.pS;
  UIManager.updatePossessionSkills(possessSkills);
  for(var i=0; i<4; i++){
    for(var j=0; j<changeSkills.pS.length; j++){
      var skillData = objectAssign({}, util.findData(skillTable, 'index', changeSkills.pS[j]));
      if(equipSkillDatas[i]){
        if(equipSkillDatas[i].groupIndex === skillData.groupIndex){
          equipSkills.splice(i, 1, skillData.index);
          equipSkillDatas.splice(i, 1, skillData);
        }
      }
      if(pyroEquipSkills[i]){
        var possessSkillData = objectAssign({}, util.findData(skillTable, 'index', pyroEquipSkills[i]));
        if(possessSkillData.groupIndex === skillData.groupIndex){
          pyroEquipSkills.splice(i, 1, skillData.index);
        }
      }
      if(frosterEquipSkills[i]){
        var possessSkillData = objectAssign({}, util.findData(skillTable, 'index', frosterEquipSkills[i]));
        if(possessSkillData.groupIndex === skillData.groupIndex){
          frosterEquipSkills.splice(i, 1, skillData.index);
        }
      }
      if(mysterEquipSkills[i]){
        var possessSkillData = objectAssign({}, util.findData(skillTable, 'index', mysterEquipSkills[i]));
        if(possessSkillData.groupIndex === skillData.groupIndex){
          mysterEquipSkills.splice(i, 1, skillData.index);
        }
      }
    }
  }
};
// function updateCharSkills(charSkills){
//   pyroBaseSkill = charSkills.pBS;
//   pyroInherentPassiveSkill = charSkills.pIPS;
//   frosterBaseSkill = charSkills.fBS;
//   frosterInherentPassiveSkill = charSkills.fIPS;
//   mysterBaseSkill = charSkills.mBS;
//   mysterInherentPassiveSkill = charSkills.mIPS;
// };
function checkInherent(levelDatas){
  if(pyroLevel < levelDatas.pLv ||
     frosterLevel < levelDatas.fLv ||
     mysterLevel < levelDatas.mLv){
       return true;
  }
  return false;
};
function updateUserBuff(buffData){
  var buffImgDataList = [];

  var buffGroupData = objectAssign({}, util.findData(skillTable, 'index', buffData.iP)).buffToSelf
  var buffImgDataIndex = objectAssign({}, util.findData(buffGroupTable, 'index', buffGroupData)).buffEffectGroup;
  var buffImgData = objectAssign({}, util.findData(effectGroupTable, 'index', buffImgDataIndex));
  var hasResource = util.setResourceData(resourceTable, buffImgData);
  if(hasResource){
    buffImgDataList.push(buffImgData);
  }
  for(var i=0; i<buffData.bL.length; i++){
    buffImgDataIndex = objectAssign({}, util.findData(buffGroupTable, 'index', buffData.bL[i].id)).buffEffectGroup;
    buffImgData = objectAssign({}, util.findData(effectGroupTable, 'index', buffImgDataIndex));
    hasResource = util.setResourceData(resourceTable, buffImgData);
    if(hasResource){
      buffImgDataList.push(buffImgData);
    }
  }
  for(var i=0; i<buffData.pL.length; i++){
    buffImgDataIndex = objectAssign({}, util.findData(buffGroupTable, 'index', buffData.pL[i])).buffEffectGroup;
    buffImgData = objectAssign({}, util.findData(effectGroupTable, 'index', buffImgDataIndex));
    hasResource = util.setResourceData(resourceTable, buffImgData);
    if(hasResource){
      buffImgDataList.push(buffImgData);
    }
  }
  for(var i=0; i<buffData.aL.length; i++){
    buffImgDataIndex = objectAssign({}, util.findData(buffGroupTable, 'index', buffData.aL[i])).buffEffectGroup;
    buffImgData = objectAssign({}, util.findData(effectGroupTable, 'index', buffImgDataIndex));
    hasResource = util.setResourceData(resourceTable, buffImgData);
    if(hasResource){
      buffImgDataList.push(buffImgData);
    }
  }
  Manager.updateUserBuffImgData(buffData.oID, buffImgDataList);
};
function updateMobBuff(mobID, buffList){
  var buffImgDataList = [];
  for(var i=0; i<buffList.length; i++){
    buffImgDataIndex = objectAssign({}, util.findData(buffGroupTable, 'index', buffList[i])).buffEffectGroup;
    buffImgData = objectAssign({}, util.findData(effectGroupTable, 'index', buffImgDataIndex));
    hasResource = util.setResourceData(resourceTable, buffImgData);
    if(hasResource){
      buffImgDataList.push(buffImgData);
    }
  }
  Manager.updateMobBuffImgData(mobID, buffImgDataList);
}
function setCanvasScale(gameConfig){
  gameConfig.scaleX = 1;
  gameConfig.scaleY = 1;
  if(gameConfig.canvasSize.width >= gameConfig.CANVAS_MAX_LOCAL_SIZE.width){
    gameConfig.scaleX =  (gameConfig.canvasSize.width / gameConfig.CANVAS_MAX_LOCAL_SIZE.width);
  }
  if(gameConfig.canvasSize.height >= gameConfig.CANVAS_MAX_LOCAL_SIZE.height){
    gameConfig.scaleY = (gameConfig.canvasSize.height / gameConfig.CANVAS_MAX_LOCAL_SIZE.height);
  }
  if(gameConfig.scaleX > gameConfig.scaleY){
    gameConfig.scaleFactor = gameConfig.scaleX;
  }else{
    gameConfig.scaleFactor = gameConfig.scaleY;
  }
};
function calcOffset(){
  return {
    x : Manager.user.center.x - gameConfig.canvasSize.width/(2 * gameConfig.scaleFactor),
    y : Manager.user.center.y - gameConfig.canvasSize.height/(2 * gameConfig.scaleFactor)
  };
};

//apply account data
function applyAccount() {
  var levels = _u.l.split(',');
  var isFirst = _u.f;
  pyroLevel = parseInt(levels[0]);
  frosterLevel = parseInt(levels[1]);
  mysterLevel = parseInt(levels[2]);

  var pyroSkillLevel = Math.floor(pyroLevel / 5) + 1;
  var frosterSkillLevel = Math.floor(frosterLevel / 5) + 1;
  var mysterSkillLevel = Math.floor(mysterLevel / 5) + 1;

  var pyroBaseSkillGID = objectAssign({}, util.findData(skillTable, 'index', pyroBaseSkill)).groupIndex;
  var pyroPassiveSkillGID = objectAssign({}, util.findData(skillTable, 'index', pyroInherentPassiveSkill)).groupIndex;
  var frosterBaseSkillGID = objectAssign({}, util.findData(skillTable, 'index', frosterBaseSkill)).groupIndex;
  var frosterPassiveSkillGID = objectAssign({}, util.findData(skillTable, 'index', frosterInherentPassiveSkill)).groupIndex;
  var mysterBaseSkillGID = objectAssign({}, util.findData(skillTable, 'index', mysterBaseSkill)).groupIndex;
  var mysterPassiveSkillGID = objectAssign({}, util.findData(skillTable, 'index', mysterInherentPassiveSkill)).groupIndex;

  pyroBaseSkill = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'groupIndex', pyroBaseSkillGID, 'level', pyroSkillLevel)).index;
  pyroInherentPassiveSkill = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'groupIndex', pyroPassiveSkillGID, 'level', pyroSkillLevel)).index;
  frosterBaseSkill = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'groupIndex', frosterBaseSkillGID, 'level', frosterSkillLevel)).index;
  frosterInherentPassiveSkill = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'groupIndex', frosterPassiveSkillGID, 'level', frosterSkillLevel)).index;
  mysterBaseSkill = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'groupIndex', mysterBaseSkillGID, 'level', mysterSkillLevel)).index;
  mysterInherentPassiveSkill = objectAssign({}, util.findDataWithTwoColumns(skillTable, 'groupIndex', mysterPassiveSkillGID, 'level', mysterSkillLevel)).index;

  if (!isFirst) {
    UIManager.clearTutorial();
  }
  UIManager.setStartSceneLevels(pyroLevel, frosterLevel, mysterLevel);
}
//count frame per second
function FrameCounter(){
  this.lastFrameCount = 0;
  this.lastFrameTime = Date.now();
  this.frameCount = 0;
};
FrameCounter.prototype.countFrames = function(){
  this.frameCount ++;
  if(Date.now() >= this.lastFrameTime + 1000){
    this.lastFrameTime = Date.now();
    this.lastFrameCount = this.frameCount;
    this.frameCount = 0;
  }
};

//draw start
changeState(gameConfig.GAME_STATE_LOAD);
setInterval(function(){
  if(Date.now() >= userLastActionTime + gameConfig.LIMIT_NO_ACTION_TIME){
    console.log('disconnected ', new Date());
    // if (socket) {
    //   socket.close();
    // }
    // window.onbeforeunload = '';
    window.location.href = "/noaction"
  }
}, gameConfig.LONG_TIME_INTERVAL);

},{"../../modules/client/CManager.js":4,"../../modules/client/CUIManager.js":8,"../../modules/client/CUser.js":9,"../../modules/client/WebSocketClient.js":10,"../../modules/public/csvjson.js":11,"../../modules/public/data.json":12,"../../modules/public/gameConfig.json":13,"../../modules/public/objectAssign.js":15,"../../modules/public/util.js":18}]},{},[52]);

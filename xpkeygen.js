import BigInteger from './jsbn'; // Adjust the path to jsbn.js
import Barrett from './jsbn2'; // Adjust the path to jsbn2.js
import calcSHA1 from './sha1'; // Adjust the path to sha1.js

function addmod(x, a, b, m) {
	a.addTo(b, x);
	while (x.compareTo(m) >= 0) { x.subTo(m, x); }
}
function dblmod(x, a, m) {
	a.lShiftTo(1, x);
	while (x.compareTo(m) >= 0) { x.subTo(m, x); }
}
function submod(x, a, b, m) {
	a.subTo(b, x);
	while (x.compareTo(BigInteger.ZERO) < 0) { x.addTo(m, x); }
}
function mulmod(x, a, b, barrett) {
	barrett.mulTo(a, b, x);
}
function sqrmod(x, a, barrett) {
	barrett.sqrTo(a, x);
}

function Point(x, y, inf) {
	this.x = x;
	this.y = y;
	this.inf = inf;
}

function Ecc(a, b, p) {
	this.barrett = new Barrett(p);
	this.p = p;
	this.a = a;
	this.b = b;
}

function pinf() { return new Point(0, 0, true); }

Ecc.prototype.add = function(p1, p2) {
	if (p1.inf) { return p2; }
	if (p2.inf) { return p1; }
	var t1 = nbi();
	var t2 = nbi();
	var l = nbi();
	if (p1.x.compareTo(p2.x) != 0) {
		submod(t1, p1.y, p2.y, this.p);
		submod(t2, p1.x, p2.x, this.p);
	} else {
		if (p1.y.compareTo(p2.y) != 0 || p2.y.compareTo(BigInteger.ZERO) == 0) { return Ecc.INF; }
		sqrmod(t1, p2.x, this.barrett);
		dblmod(t2, t1, this.p);
		addmod(t1, t2, t1, this.p);
		addmod(t1, t1, this.a, this.p);
		dblmod(t2, p2.y, this.p);
	}
	mulmod(l, t1, t2.modInverse(this.p), this.barrett);
	
	var x3 = nbi();
	var y3 = nbi();
	sqrmod(x3, l, this.barrett);
	submod(x3, x3, p1.x, this.p);
	submod(x3, x3, p2.x, this.p);
	
	submod(y3, p2.x, x3, this.p);
	mulmod(t1, y3, l, this.barrett);
	submod(y3, t1, p2.y, this.p);
	return new Point(x3, y3, false);
}

Ecc.prototype.neg = function(p) {
	var ny = nbi();
	this.p.subTo(p.y, ny);
	return new Point(p.x, ny, false);
}

Ecc.prototype.mul = function(p1, n) {
	var p = pinf();
	var i;
	var n3 = nbi();
	n.addTo(n, n3);
	n.addTo(n3, n3);
	var np1 = this.neg(p1);
	for (i = n3.bitLength() - 1; i >= 1; i--) {
		p = this.add(p, p);
		if (n3.testBit(i) && !n.testBit(i)) {
			p = this.add(p, p1);
		} else if (!n3.testBit(i) && n.testBit(i)) {
			p = this.add(p, np1);
		}
	}
	return p;
}

var cset = "BCDFGHJKMPQRTVWXY2346789";
var hexc = "0123456789abcdef";
		
var xpecc = new Ecc(
	new BigInteger("1", 16),
	new BigInteger("0", 16),
	new BigInteger("92ddcf14cb9e71f4489a2e9ba350ae29454d98cb93bdbcc07d62b502ea12238ee904a8b20d017197aae0c103b32713a9", 16)
);

var g = new Point(
	new BigInteger("46e3775ece21b0898d39bea57050d422a0af989e497962baee2cb17e0a28d5360d5476b8dc966443e37a14f1aef37742", 16),
	new BigInteger("7c8e741d2c34f4478e325469cd491603d807222c9c4ac09ddb2b31b3ce3f7cc191b3580079932bc6bef70be27604f65e", 16),
	false
);

// order of g
var order = new BigInteger("db6b4c58efbafd", 16);

// pirvate key
var priv = new BigInteger("565b0dff8496c8", 16);

function hexToByte(s) {
	t = "";
	var i, j;
	if (s.length % 2 != 0) { s = "0" + s; }
	for (i = 0; i < s.length; i += 2) {
		t += String.fromCharCode(parseInt(s.substr(i, 2), 16));
	}
	return t;
}

function reverse(s) {
	t = "";
	var i;
	for (i = s.length - 1; i >= 0; i--) {
		t += s.charAt(i);
	}
	return t;
}

function random(n) {
	t = "";
	var i;
	for (i = 0; i < 2*n; i++) {
		t += hexc.charAt(Math.floor(Math.random() * 16));
	}
	k = nbi();
	k.fromString(t, 16);
	return k;
}

function generate() {
	pid = 640000000 << 1;
	maxkey = new BigInteger("62A32B15517FFFFFFFFFFFFFFFFFF", 16); // 24^25-1
	do {
		// calculate the Schnorr signature of pid (http://en.wikipedia.org/wiki/Schnorr_signature)
		var k = random(7);
		//log("k: " + k.toString(16));
		var r = xpecc.mul(g, k);
		var x = reverse(hexToByte(r.x.toString(16)));
		var y = reverse(hexToByte(r.y.toString(16)));
		while (x.length < 48) { x = x + '&#65533;'; }
		while (y.length < 48) { y = y + '&#65533;'; }
		var h = calcSHA1(
			String.fromCharCode(pid & 0xff) +
			String.fromCharCode((pid >> 8) & 0xff) +
			String.fromCharCode((pid >> 16) & 0xff) +
			String.fromCharCode((pid >> 24) & 0xff) +
			x + y
		);
		h = hexToByte(h.substr(0, 8));
		h = (h.charCodeAt(0) + (h.charCodeAt(1) << 8) + (h.charCodeAt(2) << 16) + (h.charCodeAt(3) << 24)) >>> 4;
		h = new BigInteger(h.toString(16), 16);

		var s = nbi();
		priv.multiplyTo(h, s);
		s = s.mod(order);
		// private key is inverted, add instead of subtract
		s.addTo(k, s);
		while (s.compareTo(order) >= 0) { s.subTo(order, s); }
		
		// key = s (56) || h (28) || pid (31)
		var key = new BigInteger(pid.toString(16), 16);
		key.addTo(h.shiftLeft(31), key);
		key.addTo(s.shiftLeft(59), key);
	} while (key.compareTo(maxkey) > 0);
	var skey = "";
	var t;
	var i;
	var base = new BigInteger("24", 10);
	// skey = base 24 of key
	for (i = 0; i < 25; i++) {
		t = key.divideAndRemainder(base);
		key = t[0];
		t = t[1];
		skey = cset.charAt(parseInt(t.toString(16), 16)) + skey;
	}
	t = "";
	for (i = 0; i < 25; i++) {
		t += skey.charAt(i);
		if (i != 24 && i % 5 == 4) { t += "-"; }
	}
	return t;
}

const XPKeygen = {
    generate: function () {
        var key = generate();
        return key;
    }
};

// Export XPKeygen object
export default XPKeygen;

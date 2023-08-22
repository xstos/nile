function NLReal (v) {
  return {
    _type: "Real",
    value: v,
  };
}
function NLRealUnbox (r) {
  return r.value;
}
function NLPoint (x,y) {
  return {
    _type: "Point",
    x: NLReal(x),
    y: NLReal(y),
  };
}
function NLPointUnbox (p) {
  return { x:p.x.value, y:p.y.value };
}
function NLBezier (x1,y1,x2,y2,x3,y3) {
  return {
    _type: "Bezier",
    A: NLPoint(x1,y1),
    B: NLPoint(x2,y2),
    C: NLPoint(x3,y3),
  };
}
function NLEdgeSample (x,y,area,height) {
  return {
    _type: "EdgeSample",
    x: NLReal(x),
    y: NLReal(y),
    area: NLReal(area),
    height: NLReal(height),
  };
}
function NLEdgeSampleUnbox (s) {
  return { x:s.x.value, y:s.y.value, area:s.area.value, height:s.height.value };
}
function NLBezierUnbox (b) {
  return { A:NLPointUnbox(b.A), B:NLPointUnbox(b.B), C:NLPointUnbox(b.C) };
}
function NLSpanCoverageUnbox (s) {
  return { x:s.x.value, y:s.y.value, coverage:s.coverage.value, length:s.length.value };
}
function NLPointCoverageUnbox (s) {
  return { x:s.x.value, y:s.y.value, coverage:s.coverage.value };
}
function NLSpanCoverage (x,y,coverage,length) {
  return {
    _type: "SpanCoverage",
    x: NLReal(x),
    y: NLReal(y),
    coverage: NLReal(coverage),
    length: NLReal(length),
  };
}
function NLPixel (x,y, r,g,b,a) {
  return {
    _type: "Pixel",
    P: NLPoint(x,y),
    color: NLColor(r,g,b,a),
  };
}
const stream = [
  NLBezier(0.1,0.1, 0.1,3.0, 0.1,5.9),
  NLBezier(0.1,5.9, 5.9,5.9, 5.9,3.0),
  NLBezier(5.9,3.0, 5.9,0.1, 0.1,0.1),
]

function lerp (a,b,t) { return a + (b - a) * t; }

function stroke(items) {
  var points = [];
  var ret = []
  Array.forEach(items, function (item) {
    var bezier = NLBezierUnbox(item);
    points.push(bezier.A, bezier.B, bezier.C);
  });
  if (points.length === 0) { return [] }

  var minPoint = { x:points[0].x, y:points[0].y };
  var maxPoint = { x:points[0].x, y:points[0].y };

  points.forEach(point => {
    minPoint.x = Math.min(minPoint.x, point.x);
    minPoint.y = Math.min(minPoint.y, point.y);
    maxPoint.x = Math.max(maxPoint.x, point.x);
    maxPoint.y = Math.max(maxPoint.y, point.y);
  });

  var midPoint = { x:0.5*(maxPoint.x + minPoint.x), y:0.5*(maxPoint.y + minPoint.y) };

  function transformPoint(p) {
    return { x: lerp(p.x, midPoint.x, 0.5), y: lerp(p.y, midPoint.y, 0.5) };
  }
  ret = [...items]
  const rev = Array.reverse(items)
  rev.forEach(item=>{
    var b = NLBezierUnbox(item);
    var A = transformPoint(b.C);
    var B = transformPoint(b.B);
    var C = transformPoint(b.A);
    ret.push(NLBezier(A.x,A.y,B.x,B.y,C.x,C.y))
  })
  return {
    name: "stroke",
    Bezier: [ret]
  }
}
function midPoint(p,q) {
  return { x:0.5*(p.x + q.x), y:0.5*(p.y + q.y) };
}
function decomposeBeziers(items) {
  var ep = 0.1;
  var ret = []
  const strm = [...items]
  NLStreamForAll(strm,(item,i) => {
    var Z = NLBezierUnbox(item);
    var inside = { x:(Math.floor(Z.A.x) == Math.floor(Z.C.x) || Math.ceil(Z.A.x) == Math.ceil(Z.C.x)),
      y:(Math.floor(Z.A.y) == Math.floor(Z.C.y) || Math.ceil(Z.A.y) == Math.ceil(Z.C.y)) };
    if (inside.x && inside.y) {
      var P = { x:Math.floor(Math.min(Z.A.x, Z.C.x)), y:Math.floor(Math.min(Z.A.y, Z.C.y)) };
      var w = P.x + 1 - midPoint(Z.A,Z.C).x;
      var h = Z.C.y - Z.A.y;
      var edgeSample = NLEdgeSample(P.x + 0.5,P.y + 0.5, w*h, h);
      ret.push(edgeSample)
    }
    else {
      var M = midPoint(midPoint(Z.A,Z.B), midPoint(Z.B,Z.C));
      var min = { x:Math.floor(M.x), y:Math.floor(M.y) };
      var max = { x:Math.ceil(M.x), y:Math.ceil(M.y) };
      var dmin = { x:M.x - min.x, y:M.y - min.y };
      var dmax = { x:M.x - max.x, y:M.y - max.y };
      var N = {};
      N.x = (Math.abs(dmin.x) < ep) ? min.x : (Math.abs(dmax.x) < ep) ? max.x : M.x;
      N.y = (Math.abs(dmin.y) < ep) ? min.y : (Math.abs(dmax.y) < ep) ? max.y : M.y;

      var AB = midPoint(Z.A,Z.B);
      var BC = midPoint(Z.B,Z.C);
      NLStreamPush(strm,NLBezier(N.x,N.y,BC.x,BC.y,Z.C.x,Z.C.y),i)
      NLStreamPush(strm,NLBezier(Z.A.x,Z.A.y,AB.x,AB.y,N.x,N.y),i)
    }
  });
  return {
    name: "decomposeBeziers",
    EdgeSample: [ret]
  }
}
function sort(items) {
  const ret = [...items]
  ret.sort((a, b) => {
    var pa = NLPointUnbox(a);
    var pb = NLPointUnbox(b);
    return (pa.y - pb.y) || (pa.x - pb.x);
  });
  return ret
}

function combineEdgeSamples(process) {
  var x = 0, y = 0, A = 0, H = 0;
  var ret = []
  process.forEach(item => {
    var edgeSample = NLEdgeSampleUnbox(item);
    var newX = edgeSample.x, newY = edgeSample.y, a = edgeSample.area, h = edgeSample.height;
    var newA = A, newH = H;
    if (newY == y) {
      if (newX == x) {
        newA = A + a;
        newH = H + h;
      }
      else {
        newA = H + a;
        newH = H + h;
        ret.push(
            NLSpanCoverage(x,  y,Math.min(Math.abs(A),1), 1),
            NLSpanCoverage(x+1,y,Math.min(Math.abs(H),1), newX - x - 1),
        )
      }
    }
    else {
      newA = a;
      newH = h;
      ret.push(
          NLSpanCoverage(x,y,Math.min(Math.abs(A),1), 1)
      )
    }

    x = newX; y = newY; A = newA; H = newH;
  });
  ret.push(
      NLSpanCoverage(x,y,Math.min(Math.abs(A),1), 1)
  )
  return {
    name: "combineEdgeSamples",
    SpanCoverage: [ret]
  }
}

function rasterize(items) {
  const decomp = decomposeBeziers(items).EdgeSample[0]
  const sorted = sort(decomp)
  const combEdg = combineEdgeSamples(sorted)
  return combEdg
}

function texture(items) {
  const expandSpans = expandSpans(items)
  const ret = pipe(
      expandSpans,
      projectLinearGradient,
      padGradient,
      gradientSpan,

  )(items)
  return [ret,expandSpans]
}
function shape(items) {
  const beziers = stroke(items).Bezier[0]
  const edgeSam = rasterize(beziers).SpanCoverage[0]
  const texFoo = texture(edgeSam)
  return texFoo
}
function pipe(...fns) {
  function ret(x) {
    return fns.reduce((v, f) => f(v), x);
  }
  return ret;
}

function expandSpans(process) {
  const inputStream = [...process]
  const ret = []
  NLStreamForAll(inputStream, (item,i) => {
    var span = NLSpanCoverageUnbox(item);
    if (span.coverage > 0 && span.length > 0) {
      ret.push(NLPointCoverage(span.x,span.y,span.coverage))
      NLStreamPush(inputStream,
          NLSpanCoverage(span.x + 1, span.y, span.coverage, span.length - 1),i)
    }
  });
  return ret
}
function projectLinearGradient(process) {
  const ret = []
  var A = {x:1, y:4}, B = {x:4, y:2};
  var v = { x:B.x - A.x, y:B.y - A.y };
  var vn = v.x * v.x + v.y * v.y;
  var delS = { x:v.x / vn, y:v.y / vn };
  var s00 = A.x * delS.x + A.y * delS.y;
  process.forEach(item=>{
    var pointCoverage = NLPointCoverageUnbox(item);
    var value = (pointCoverage.x * delS.x + pointCoverage.y * delS.y) - s00;
    ret.push(NLReal(value))
  })
  return ret
}
function padGradient(process) {
  var ret = []
  process.forEach(item=>{
    var s = NLRealUnbox(item);
    var value = Math.max(0, Math.min(1, s));
    ret.push(NLReal(value))
  })
  return ret
}
function gradientSpan(process) {
  var A = {r:0, g:1, b:1, a:1}, B = {r:0, g:0, b:0, a:1};
  const ret =[]
  process.forEach(process, item => {
    var s = NLRealUnbox(item);
    var C = { r:lerp(A.r, B.r, s), g:lerp(A.g, B.g, s), b:lerp(A.b, B.b, s), a:lerp(A.a, B.a, s) };
    ret.push(NLColor(C.r,C.g,C.b,C.a))
  });
  return ret
}
function zipPixels(colors, pointCoverages) {
  const ret = []
  NLStreamZipWith(colors, pointCoverages, (item1, item2) => {
    var color = NLColorUnbox(item1);
    var pointCoverage = NLPointCoverageUnbox(item2);
    var pixel = NLPixel(pointCoverage.x, pointCoverage.y, color.r, color.g, color.b, color.a * pointCoverage.coverage);
    ret.push(pixel)
  });
  return ret
}
function NLStreamPush (stream, item, iter) {
  stream.push(item)
}
function NLStreamForAll (stream, f) {
  for (var i = 0; i < stream.length; i++) {
    var item = stream[i];
    f(item,i);
  }
}
function NLStreamZipWith (stream1, stream2, f) {
  var length = Math.min(stream1.length, stream2.length);
  for (var i = 0; i < length; i++) {
    var item1 = stream1[i];
    var item2 = stream2[i];
    f(item1,item2);
  }
}

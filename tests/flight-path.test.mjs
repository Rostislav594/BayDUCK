import test from "node:test";
import assert from "node:assert/strict";
import { planStraightFlight, planFlightPath, sampleFlightPath, fitFlightPath } from "../src/flight-path.js";

test("direct flights keep one straight segment at uniform speed in every direction", () => {
  const end = {x:100,y:100};
  for (const start of [{x:20,y:30},{x:240,y:30},{x:20,y:260},{x:240,y:260},{x:100,y:20},{x:20,y:100}]) {
    const route = planStraightFlight({start,end});
    assert.equal(route.length,Math.hypot(end.x-start.x,end.y-start.y));
    for (const progress of [0,.1,.5,.9,1]) {
      const point = sampleFlightPath(route,route.length*progress);
      assert.ok(Math.abs(point.x-(start.x+(end.x-start.x)*progress))<1e-9);
      assert.ok(Math.abs(point.y-(start.y+(end.y-start.y)*progress))<1e-9);
    }
    assert.deepEqual(start,route.points[0]);
    assert.notEqual(start,route.points[0]);
  }
});

function checkClearance(route, obstacles, radius) {
  for (let at = 0; at <= route.length; at += 1) {
    const p = sampleFlightPath(route, at);
    assert.ok(!obstacles.some(r => p.x > r.left-radius && p.x < r.right+radius
      && p.y > r.top-radius && p.y < r.bottom+radius), `Obstacle crossed at ${p.x}, ${p.y}`);
  }
}

test("curved route goes around a blocking card and finishes vertically above the basket", () => {
  const obstacles = [{left:160, right:430, top:180, bottom:370}];
  const route = planFlightPath({start:{x:520,y:510}, approach:{x:70,y:80}, end:{x:70,y:150}, width:600,height:600,obstacles,radius:14});
  checkClearance(route, obstacles, 14);
  assert.deepEqual(route.points[0], {x:520,y:510});
  assert.deepEqual(route.points.at(-1), {x:70,y:150});
  const a=sampleFlightPath(route, route.length-20), b=sampleFlightPath(route,route.length-4);
  assert.equal(a.x,70);
  assert.equal(b.x,70);
  assert.ok(b.y>a.y);
  const direct=Math.hypot(450,430)+70;
  assert.ok(route.length>direct, "The obstacle produces a detour");
});

test("route fits a narrow corridor beside a search field without rounding through it", () => {
  const obstacles = [
    {left:80,right:550,top:100,bottom:200},
    {left:20,right:580,top:300,bottom:350},
    {left:150,right:450,top:400,bottom:440},
  ];
  const route=planFlightPath({start:{x:520,y:520},approach:{x:40,y:60},end:{x:40,y:150},width:600,height:600,obstacles,radius:8});
  checkClearance(route,obstacles,8);
  assert.ok(route.points.every(p=>p.x>=9 && p.x<=591 && p.y>=9 && p.y<=591));
  assert.ok(route.points.some(p=>p.x<20 && p.y>300 && p.y<350));
});

test("distance sampling stays stable at endpoints and along long paths", () => {
  const route=planFlightPath({start:{x:420,y:440},approach:{x:60,y:50},end:{x:60,y:130},width:500,height:500,obstacles:[],radius:10});
  assert.equal(sampleFlightPath(route,-10).x,420);
  assert.equal(sampleFlightPath(route,route.length+100).y,130);
  for (let d=10;d<route.length;d+=10) {
    const a=sampleFlightPath(route,d-10),b=sampleFlightPath(route,d);
    assert.ok(Math.hypot(b.x-a.x,b.y-a.y)<=10.001);
    assert.ok(Number.isFinite(b.angle));
  }
});

test("an impassable page region is never replaced by a path through the obstacle", () => {
  assert.throws(()=>planFlightPath({start:{x:200,y:380},approach:{x:60,y:50},end:{x:60,y:100},width:400,height:400,obstacles:[{left:0,right:400,top:200,bottom:250}],radius:8}), /No clear route/);
});

test("explicit tight clearance can use a narrow opening without crossing the cards", () => {
  const obstacles=[{left:0,right:196,top:150,bottom:250},{left:204,right:400,top:150,bottom:250}];
  const options={start:{x:200,y:360},approach:{x:200,y:40},end:{x:200,y:90},width:400,height:400,obstacles,radius:10};
  assert.throws(()=>planFlightPath(options),/No clear route/);
  const route=planFlightPath({...options,minClearance:1});
  assert.equal(route.clearance,1);
  checkClearance(route,obstacles,0);
});

test("full-size path fitting keeps artwork in bounds and remeasures distance for uniform speed", () => {
  const route=planFlightPath({start:{x:100,y:350},approach:{x:20,y:40},end:{x:20,y:110},width:400,height:400,obstacles:[],radius:8});
  const fitted=fitFlightPath(route,{width:400,height:400,halfWidth:45,halfHeight:55,catchDistance:80});
  for (let i=0;i<fitted.points.length;i++) {
    const p=fitted.points[i];
    if (route.length-route.lengths[i]>=80) {
      assert.ok(p.x>=46 && p.x<=354 && p.y>=56 && p.y<=344);
    }
    if (i>0) {
      const a=fitted.points[i-1];
      assert.ok(Math.abs(fitted.lengths[i]-fitted.lengths[i-1]-Math.hypot(p.x-a.x,p.y-a.y))<1e-9);
    }
  }
  assert.equal(fitted.length,fitted.lengths.at(-1));
  assert.deepEqual(fitted.points.at(-1),route.points.at(-1));
});

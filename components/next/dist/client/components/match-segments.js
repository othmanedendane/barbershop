"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.canSegmentBeOverridden = exports.matchSegment = void 0;
var _getSegmentParam = require("../../server/app-render/get-segment-param");
const matchSegment = (existingSegment, segment)=>{
    // Common case: segment is just a string
    if (typeof existingSegment === 'string' && typeof segment === 'string') {
        return existingSegment === segment;
    }
    // Dynamic parameter case: segment is an array with param/value. Both param and value are compared.
    if (Array.isArray(existingSegment) && Array.isArray(segment)) {
        return existingSegment[0] === segment[0] && existingSegment[1] === segment[1];
    }
    return false;
};
exports.matchSegment = matchSegment;
const canSegmentBeOverridden = (existingSegment, segment)=>{
    var ref;
    if (Array.isArray(existingSegment) || !Array.isArray(segment)) {
        return false;
    }
    return ((ref = (0, _getSegmentParam).getSegmentParam(existingSegment)) == null ? void 0 : ref.param) === segment[0];
};
exports.canSegmentBeOverridden = canSegmentBeOverridden;

if ((typeof exports.default === 'function' || (typeof exports.default === 'object' && exports.default !== null)) && typeof exports.default.__esModule === 'undefined') {
  Object.defineProperty(exports.default, '__esModule', { value: true });
  Object.assign(exports.default, exports);
  module.exports = exports.default;
}

//# sourceMappingURL=match-segments.js.map
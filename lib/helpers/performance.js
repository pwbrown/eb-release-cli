var perfy = require('perfy'),
    perfMessage = require('./messenger').performance;

exports.start = function(name){
    perfy.start(name);
}

exports.end = function(name){
    var results = perfy.end(name);
    perfMessage(results.summary);
}
const dlcache = require('.')
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const async = require("async");

const dlcachedir = path.join(__dirname, "build", "tmpdlcache")
const file = path.join(dlcachedir, "https_/ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js")
process.env.DLCACHEDIR = dlcachedir

const testurl = new URL("https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js")
const correctCksum = "668b046d12db350ccba6728890476b3efee53b2f42dbb84743e5e9f1ae0cc404"
const badCksum = "668b046d12db350ccba6728890476b3efee53b2f42dbb84743e5e9f1ae0cc555"

async.series([
    (cb) => {
        fs.rmSync(dlcachedir, {recursive: true, force: true})
        cb()
    },
    (cb) => { // test bad cksum rejection
        dlcache.dl(testurl, {sha256: badCksum})
        .then(function(res) {
            assert.fail()
        }, function(err) {
            cb()
        })
    },
    (cb) => { // positive test
        dlcache.dl(testurl, {sha256: correctCksum}
        ).then(function(res) {
            assert(res.endsWith("jquery.min.js"))
            cb()
        }, function(err) {
            assert.fail()
        })
    },
    (cb) => { // no checksum test if already downloaded
        fs.writeFileSync(file, "bad data")
        dlcache.dl(testurl, {sha256: badCksum}
        ).then(function(res) {
            assert(res.endsWith("jquery.min.js"))
            cb()
        }, function(err) {
            assert.fail()
        })
    }
], function(err){
    if(err) {
        throw err
    } else {
        console.log("All tests finished successfully.")
    }
});


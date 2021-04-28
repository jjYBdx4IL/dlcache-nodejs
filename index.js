const crypto = require('crypto');
const { http, https } = require('follow-redirects');
const os = require('os');
const fs = require('fs');
const path = require('path');

function cacheDir() {
    var cdir = process.env.DLCACHEDIR;
    if (cdir) {
        return cdir
    }
    if (os.platform() == 'win32') {
        cdir = path.join(process.env.LocalAppData, "dlcache")
    }
    else if (process.env.HOME) {
        cdir = path.join(process.env.HOME, ".cache", "dlcache")
    }
    if (!cdir) {
        throw new Error("unsupported platform (non-Windows systems must have at least HOME env var set)")
    }
    return cdir
}

/**
 * 
 * @param {DlOpts} opts
 * @param {string} tmppath
 * @param {string} fullpath
 * @param {(value: string | PromiseLike<string>) => void} resolve 
 * @param {(reason?: any) => void} reject
 */
function cksumvfy(opts, tmppath, fullpath, resolve, reject) {
    const hash = crypto.createHash(opts.sha512 ? 'sha512' : 'sha256');
    const stream = fs.createReadStream(tmppath);
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => {
        const digest = hash.digest('hex').toLowerCase()
        const expdigest = (opts.sha512 ? opts.sha512 : opts.sha256).toLowerCase()
        if (digest != expdigest) {
            reject(`digest mismatch for ${tmppath}: ${digest} vs expected ${expdigest}`)
        } else {
            try {
                fs.renameSync(tmppath, fullpath)
            } catch (err) {
                reject(err)
            }
            resolve(fullpath)
        }
    });
}

/**
 * Downloads the given url (http or https) to %LOCALAPPDATA%\dlcache (Windows) or $HOME/.cache/dlcache
 * (other systems) - unless the DLCACHEDIR env var is set. At least one checksum must be given.
 * Returns the path to the downloaded file. Throws an error otherwise. The checksum is only verified
 * after download. Otherwise the path to the cached file is being returned without checking the checksum.
 * 
 * Supported ciphers: sha256, sha512
 * 
 <code>
    const dlcache = require('dlcache')
    ...
    dlcache.dl(new URL('https://.../a/b.zip'), {sha512: 'ef673...'}).then(function(zipfile) {
        extract(zipfile, { dir: tmpd }).then(function() {
            fs.renameSync(path.join(tmpd, "solr-" + managedSolrVersion), managedSolrPath)
            fs.rmSync(tmpd, {recursive: true, maxRetries: 10, retryDelay: 1000, force: true})
            cb()
        }, function(err) {
            cb(new Error(err))
        })
    }, function(err) {
        cb(new Error(err))
    })
 </code>
 * 
 * @param {URL} url 
 * @param {DlOpts} opts
 * @returns {Promise<string>} local path to the cached file
 */
function dl(url, opts = undefined) {
    return new Promise((resolve, reject) => {
        var tmppath = undefined
        try {
            if (!opts) {
                throw new Error("checksum required")
            }
            const cdir = cacheDir()
            const relpath = url.toString().replace(/[^A-Za-z0-9/.-]/, "_")
            const fullpath = path.join(cdir, relpath)
            const ppath = path.dirname(fullpath)
            tmppath = path.join(ppath, "." + path.basename(fullpath) + ".tmp")
            if (fs.existsSync(fullpath)) {
                resolve(fullpath)
            }
            if (!fs.existsSync(ppath)) {
                fs.mkdirSync(ppath, { recursive: true })
            }
            const ws = fs.createWriteStream(tmppath)
            const req = url.protocol == 'http' ? http.get(url) : https.get(url)
            req.on('response', function (res) {
                res.pipe(ws).on('close', function () { cksumvfy(opts, tmppath, fullpath, resolve, reject) })
            }).on('error', function (err) {
                reject(err)
            })
        } catch (err) {
            reject(err)
        } finally {
            try {
                if (tmppath && fs.existsSync(tmppath)) {
                    fs.rmSync(tmppath, {force: true})
                }
            } catch (err) {}
        }
    })
}

exports.dl = dl

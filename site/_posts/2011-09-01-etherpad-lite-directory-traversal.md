---
layout: post
title: Directory traversal vulnerability in Etherpad lite
tags:
- Directory traversal
- Etherpad lite
- Node.js
- Security
---

[Etherpad lite](https://github.com/pita/etherpad-lite) is a great, node.js-based Etherpad clone. Unfortunately, the code base is young and thus the bugs are fresh and evil.

Since in node.js you implement your whole web server, static file serving is not on by default (as in Apache or most other web servers); instead, the web server connect.js which is used by Etherpad lite provides static file routes. Unfortunately, the file name in the static file route used by Etherpad lite is [not cleaned at all](http://en.wikipedia.org/wiki/Directory_traversal). Try `http://example.com/static/../settings.json` on your ep-lite instance.

The following patch fixes the issue:

```
--- a/node/server.js
+++ b/node/server.js
@@ -99,7 +99,7 @@ async.waterfall([
     app.get('/static/*', function(req, res)
     {
       res.header("Server", serverName);
-      var filePath = path.normalize(__dirname + "/.." + req.url.split("?")[0]);
+      var filePath = path.normalize(__dirname + "/.." +
                                     req.url.replace(/\.\./g, '').split("?")[0]);
       res.sendfile(filePath, { maxAge: exports.maxAge });
     });
```

You may fetch the patch from [the GitHub repository](https://github.com/pita/etherpad-lite/) as well.

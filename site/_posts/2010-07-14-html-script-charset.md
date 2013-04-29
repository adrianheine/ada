---
layout: post
title: The charset attribute of script elements
tags: HTML script charset DokuWiki
---

While setting up an older version of [this site](/) I saw a [HTML 5 validator](http://validator.w3.org) warning about »Required attributes missing on element script.« The provided source code snippet showed a part of a typical inline JavaScript definition as written by DokuWiki:

    <script type="text/javascript" charset="utf-8" >
    <!--//--><![CDATA[//><!--

Since the element definition lacked no required attribute I knew of, I took a look into the linked [HTML 5 specification](http://www.whatwg.org/specs/web-apps/current-work/#script). What I found was that there was actually no attribute missing, but one too much: The charset attribute »must not be specified if the src attribute is not present.«

I wondered whether this was a change from HTML 4 / XHTML to HTML 5 and looked into the [HTML 4 specification](http://www.w3.org/TR/html4/interact/scripts.html#h-18.2.1). There it says: »the charset attribute refers to the character encoding of the script designated by the src attribute; it does not concern the content of the SCRIPT element.« That‘s reasonable, since the charset of the document itself is specified [by the web server or in a separate meta tag](http://www.w3.org/TR/html4/charset.html#h-5.2.2).

In summary, the charset attribute on non-external script elements is unused in HTML 4 and forbidden in HTML 5; hence I [removed it](http://github.com/splitbrain/dokuwiki/commit/85f8167) from the HTML code DokuWiki outputs.

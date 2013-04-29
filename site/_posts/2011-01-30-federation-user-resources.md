---
layout: post
title: Why federation needs a browser-wide user resource registry
tags: HTTP Federation Session AutoCompletion AutoFill Cookie Facebook Greasemonkey HTML IFrame Like OpenID Diaspora globalStorage jData localStorage StatusNet
---

While sketching out a concept for a certain federated service, I stumbled across a technical problem which badly hurts federated services in comparison to centralized services. I’m gonna explain the problem using the example of (Facebook’s) Like button and show some possible solutions.

## The Like button

A [Facebook Like button](http://developers.facebook.com/docs/reference/plugins/like) is a piece of HTML (An iframe) which can be included on any website (I will call this website »the playground«). It allows a user to »Like« the playground without switching to Facebook or entering credentials. The following code is a stripped-down example of the HTML producing a Like button:

```
<iframe src="http://www.facebook.com/plugins/like.php?href=http%3A%2F%2Fexample.com"></iframe>
```

In order to include a Like button, the playground basically only needs to know the URL of Facebook’s Like button. Since the Like button is within the Domain »facebook.com«, it knows about the user’s Facebook session. Put together, the playground gives an URL – which includes: a domain – and gets: a Facebook user (The playground does not really get to know the user’s Facebook name neither is able to access her session – but it gets a button which can act in a defined way using the user session). I’ll call this the deal »domain/URL for session«.

## Getting federated

In the federated world, where the user has an account on one of the millions [diaspora](http://joindiaspora.com) instances, this deal is just not possible. The one thing the playground needs to provide – the domain, hence, the URL – is unknown to it. Same applies to »Tweet this« buttons – there won’t be a »Post this« button for your favorite [Status.Net](http://status.net) instance, since no website knows that this instance actually is the one you use which iframes are able to provide is broken.

For federation, we need to get rid of the »domain/URL« part in this deal. What the playground knows is no longer a domain (»facebook.com«), but rather a role (»social network/website which allows to Like a website«). The question is: How can the playground convert this role into an URL?

## A browser-wide resource registry

Generally speaking, we need a global mapping where services can register themselves for roles and websites can query which services are registered for a role. The new deal has to be »role for URL/domain for session«.

Normal sessions are stored in [HTTP Cookies](https://en.wikipedia.org/HTTP_Cookies). Cookies could be used to store arbitrary data in a browser, so there could be a cookie specifying the URL/domain part of the deal. Yet, cookies are always tied to a specific domain – there is no way to create a global cookie where the service could save an URL and then the playground fetch it.

The following is a roundup of ideas how the needed global storage could be provided, sorted by the degree of elaboration:

  * No global storage, the user has to specify the URL/domain itself
  * A central registry website which has a session where role to URL/domain mappings are saved by the user and which allows to query URLs/domains for roles via JavaScript API
  * Custom, additional HTTP headers which are sent with every request (available in some browsers)
  * An Userscript working on every page (supported in some browsers, Chromium [does not](https://sites.google.com/a/chromium.org/dev/developers/design-documents/user-scripts) support the [Userscript global storage](http://wiki.greasespot.net/Greasemonkey_Manual:API) yet.)
  * Browser extensions
  * Native browser support

A real-world solution would probably provide a JavaScript library which uses the most versatile of the following three options: browser support (be it native, through an extension or a userscript), a registry website, manual entering of the URL/domain. Browser support could even work without using JavaScript by handling [special URLs](http://en.wikipedia.org/wiki/About:_URI_scheme) like `http://about:resource/like/http%3A%2F%2Fexample.com`.

Any solution has to give the user full control. No service should be able to register itself without the user confirming it. Probably even querying the registry should need the user’s permission.

## A look around

Currently, browsers are seldom seen as a part of ourself, but rather as a neutral window through which we reach the cloud. Cyborg-wise, browsers provide few but a huge amount of cookies, a varying amount of bookmarks and bookmarklets and maybe some plugins. With HTML 5 storages and databases, the browser will get some more data, but it’s unlikely that those will be used for much more than local caches, temporary data and other non-persistent stuff. For federation’s needs, those provide no benefits, since they are tied to a specific domain just as cookies. The `globalStorage` which were present in Mozilla for some time would be a global, albeit very insecure registry as requested in this post.

There is a more elaborated approach than just registering user resources in the browser and passing them to websites: Completely handle the whole process in the browser, without the website having to do anything. This works for feeds: Readers – be it local apps or services – can be registered in the browser and later on used to subscribe to feeds. The website does not need to know anything about feed readers, it just provides feeds and adheres to feed discovery standards. Another feature which happens in the browser exclusively is [AutoCompletion](http://en.wikipedia.org/wiki/Autocomplete) or [AutoFill](http://google.com/support/chrome/bin/answer.py?answer=142893), respectively. It can be seen as a very dump, non-query-able resource storage. Bookmarklets are another mean to move functionality from websites to the browser itself – instead of a Like button on the website, the user could have a bookmarklet liking the current site on her own social network.

Moving functionality to the browser has several advances:

  * No third party gets its hands on the user’s resources: Only the user, the target service and the browser have to know where the user likes sites, subscribes to feeds or posts status messages.
  * Websites are not cluttered with uninteresting social web buttons. Instead, the set of available features fits with the user‘s usage style.
  * User’s can use their web apps on any page, not just those which allow the user to do so.

Providing a fully customizable browser user interface which let users smartly access their web services on any page is a hard challenge, though.

Any solution to the presented problem depends on the presence of open protocols which specify how to Like, Post, Befriend, Bookmark, etc. The most simple »protocol« which seems to be powerful enough is the usage of URL templates, where some placeholder indicates where the notice’s text, the site’s URL, the user‘s URI, etc. is to be inserted. There are some well-known user resources for which feature-full protocols exist, like OpenIDs, E-Mail adresses, Websites.

As a last note, there seems to exist a quite complete implementation of the »central registry website« concept I mentioned above: [jData](https://github.com/eligrey/jData-host).

Update: [Web-based protocol handlers](https://developer.mozilla.org/en/web-based_protocol_handlers) were introduced in FireFox 3 and made it into HTML 5. There is a nice [article](http://blog.mozilla.com/webdev/2010/07/26/registerprotocolhandler-enhancing-the-federated-web/) relating this feature to Status.Net federation, Universal Like buttons and the like. Thanks to gamambel and Eli Grey for mentioning this.

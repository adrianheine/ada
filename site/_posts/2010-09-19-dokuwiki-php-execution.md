---
layout: post
title: PHP execution vulnerability in DokuWiki
tags: Apache PHP Security .htaccess DokuWiki MultiViews mod_mime
id: https://ada.adrianlang.de/dokuwiki-php-execution
---
Some days ago, a new security problem in DokuWiki [got reported](http://bugs.dokuwiki.org/index.php?do=details&task_id=2020). It allows – assuming certain web server configurations – PHP (This probably applies to other languages interpreted by the web server as well) file execution for users permitted to create pages (Under some circumstances I’ll describe, even the right to edit suffices). This is quite a serious issue, but we are not able to fix it in any sane way apart from checking the server configuration and warning users. I’ll describe the problem, briefly discuss some potential solutions in DokuWiki and why we do not follow them and finally show the solutions we propose.

## The problem

Unlike most other wiki engines, DokuWiki stores page text and metadata in plain text files in a data folder. The location of the data folder is configurable. Both meta and text files’ names are derived from the page name the wiki user has chosen: With the default data directory `data/` in the DokuWiki root, a wiki page called `pagename` will have files `data/meta/pagename.meta` and `data/pages/pagename.txt`.

By default, the whole DokuWiki directory lies in the public web directory, making all files in it web-accessible. Directories which do not need to be accessed from clients are protected with `.htaccess` files – this applies to `data/`, for example. `.htaccess` files specify directory-related configuration options to the Apache web server. The normal, static Apache configuration files (and possibly `.htaccess` files from parent directories) define whether these files are used at all and which options might be configured in them. Using `.htaccess` files is generally slower than the static configuration, since they need to be read on every client request – static files are loaded once on server startup.

Some admins decide to disable `.htaccess` files, for example for performance reasons. In many cases, this is no security problem per sé: A user may read all wiki pages and metadata, but in a public wiki they are able to get this anyway. The configuration, password hashes and user data in the `conf/` directory is protected by other means not depending on `.htaccess` files (They have a `<?php exit() ?>` before the data). Informations about the subscriptions users have and the DokuWiki cookie salt are accessible, but this imposes not much of a security issue (The subscriptions leak, but are not that private data; the cookie salt allows to decrypt a cookie, thus getting the user name and password, but you first have to intercept the cookie in the first place). So, not having `.htaccess` enabled for DokuWiki seemed not like a very clever choice, but in many cases the problems imposed by this choice were acceptable. This changed.

When asked for a file, Apache’s [`mod_mime`](http://httpd.apache.org/docs/2.2/mod/mod_mime.html) module tries to determine which kind of a file it is. Afterwards, it checks whether a special handler is registered for this file type – for example the module `mod_php` for PHP files (Other extensions like `.rb`, `.py`, `.pl` could be handled by other modules and thus be executed as well). If such a handler is found, the handler is invoked instead of returning the plain file to the client. File type discovery is done [based on all extensions a filename has](http://httpd.apache.org/docs/2.2/mod/mod_mime.html#multipleext), i. e. every part of the name starting with a dot (but not the part after a leading dot). I don’t really know what happens exactly if there are multiple recognized filetypes, this seems to depend on the server configuration ([`MultiViews`](http://httpd.apache.org/docs/2.2/content-negotiation.html#multiviews) might have some impact on this). Anyways, at least one of the two files `page.php.txt` and `page.php.meta` is probably recognized as a PHP script.

Now I am going to put the pieces together:

  * A user (with create permission) creates a wiki page with a page id ending in ›.php‹: `page.php` (If a page with such a name already exists, creating the page is not even necessary)
  * She puts some malicious PHP code in it: `<?php echo file_get_contents('../../conf/users.auth.php'); ?>`
  * She directs her browser to the page’s data (or meta) file (which is not protected by `.htaccess` due to the wiki admin‘s laziness): `http://example.com/wiki/data/pages/page.php.txt` or `http://example.com/wiki/data/meta/page.php.meta`, respectively
  * Apache determines the file to be PHP and _executes it_ using `mod_php`, printing the user config and password hashes to the user

This ain’t good; you will probably not want to give PHP execution rights to your users – otherwise you may just have enabled [PHP execution in DokuWiki](https://dokuwiki.org/config:phpok) in the first place. By indirectly granting PHP execution rights, DokuWiki breaks the wiki admin’s expectations about the impact of his decision to make the data folder world-readable. I consider this a bug.

## Solutions in the code (rejected)

(I’ll further assume that configuration through `.htaccess` is not available and creation right is granted to not fully trusted users.)

We identified three main prerequisites for the issue:

  * Users have control over file names, thus getting limited control over Apache’s behaviour
  * Users can put arbitrary content in these files
  * Users know where the data folder lies and can access it from the web

Put together, users may construct arbitrary file names in a known location with their own content.

First, we could limit the control over filenames:

  * Use completely artificial names like an auto-incrementing number or a hash over the file name: Makes editing on the file system very uncomfortable and the whole system a bit slower
  * Disallow certain patterns in page IDs (from which the file names are derived): Cripples DokuWiki since page IDs like »page.php« are a valid and common use, would need a complex list of file extensions Apache might recognize as some sort of script (`.rb`, `.pl`, `.py`) 
  * Disallow certain patterns in file names (by escaping for example the dot): Not backwards-compatible, makes editing on the file system less comfortable and the whole system a bit slower

Second, we could limit the content:

  * Disallow `<?` in pages with `.php` in the name: Cripples DokuWiki since pages with `.php` in the name are very likely to contain `<?`, would need an even more complex list of file extensions, would not work for languages where there is no opening tag
  * Add `<?php exit() ?>` in front of each file: Dead ugly, would not work for anything but PHP and slows down the system a whole bit

Third, we could move the `data` folder around. This is something users already can perform through a config option. Doing it in DokuWiki would mean that we randomize the `data` folder’s name in `install.php`. This solution is not that bad, but still looks ugly in the file system: we would not want to do this for everybody while it’s only necessary for few vulnerable setups. Therefor, we decided to just warn the user about the security issue and let him take appropriate measures. Ideally, the installer would detect the problem, suggest some solutions and perform the `data` directory move automatically if the user does not fix the problem in some other way.
## Solutions in the configuration

So, how to fix the problem. If you have access to the Apache config (i. e. run you own server), enable `.htaccess` with `AllowOverwrite Limit` or include all the `.htaccess` files in the static configuration:

```
<Directory /var/www/wiki/>
    RewriteEngine on

    RewriteBase /wiki

    RewriteRule ^_media/(.*)           lib/exe/fetch.php?media=$1  [QSA,L]
    RewriteRule ^_detail/(.*)          lib/exe/detail.php?media=$1  [QSA,L]
    RewriteRule ^_export/([^/]+)/(.*)  doku.php?do=export_$1&id=$2  [QSA,L]
    RewriteRule ^$                     doku.php  [L]
    RewriteCond %{REQUEST_FILENAME}    !-f
    RewriteCond %{REQUEST_FILENAME}    !-d
    RewriteRule (.*)                   doku.php?id=$1  [QSA,L]
</Directory>

<Directory /var/www/wiki/bin/>
    order allow,deny
    deny from all
</Directory>
<Directory /var/www/wiki/inc/>
    order allow,deny
    deny from all
</Directory>
<Directory /var/www/wiki/inc/lang/>
    order allow,deny
    deny from all
</Directory>
<Directory /var/www/wiki/lib/_fla/>
    order allow,deny
    deny from all
</Directory>
<Directory /var/www/wiki/data/>
    order allow,deny
    deny from all
</Directory>
<Directory /var/www/wiki/conf/>
    order allow,deny
    deny from all
</Directory>
```

If you have no access to the Apache configuration (i. e. only have some web space) and cannot use `.htaccess` files, there are two possibilities: First, you could just disable page create access to untrustworthy people (remove edit access if you already have page names with dots or plan to use them). Second and finally, if you have no way of changing the server configuration (static or dynamic) and do want to run a completely open wiki, you have to move the `data` directory to some unusual place. Ideally, you would move it out of your web root (Maybe called »public_html«). If you have no space not accessible via web, you could still move it to a random, hard-to-guess place. Wherever you move it, do not forget to change the DokuWiki configuration accordingly.

## Links

  * [DokuWiki’s security tips](https://dokuwiki.org/security)
  * [Log of #dokuwiki discussing the problem](http://irc.dokuwiki.org/index.php?d=2010-09-09#msg265609)


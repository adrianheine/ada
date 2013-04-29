all: site/res/main.css heckle

site/res/main.css: site/_less/main.less site/_less/normalize.less site/_less/codemirror.less
	nodejs node_modules/.bin/lessc -x $< > $@

heckle:
	cd site && nodejs ../node_modules/heckle-blog

deploy:
	rsync -avz --delete-after site/_site/ kleinrot.net:public_html/ada/

.PHONY: all heckle

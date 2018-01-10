---
layout: post
title: Firefox Quantum on Debian stable
tags: Firefox Debian backports
---

This is a quick description of how to backport Firefox 57 for Debian stable.
It uses the Firefox source package from Debian sid and recompiles a few (build-)dependencies from sid as well.
Rust and Cargo are installed via `rustup` in the build environment, since it is pretty difficult to backport them.
Also, LLVM 3.9 is used instead of LLVM 4.0, since the latter is not available in stable.

Building Firefox needs about 18 GB of disk space and takes a few hours, depending on your machine.


```shell
# Install prerequisites
sudo apt install debhelper devscripts sbuild quilt

# Create build chroot
sudo sbuild-createchroot \
  --include=eatmydata,ccache,gnupg \
  --extra-repository "deb http://httpredir.debian.org/debian/ stretch-backports main" \
  --chroot-prefix=stretch-backports \
  stable \
  /tmp/stable-sbuild \
  http://httpredir.debian.org/debian/

# Make a new working directory
mkdir $WORKING_DIRECTORY && cd $WORKING_DIRECTORY

SUFFIX="~adrian"

# Build nspr from sid
dget -x http://http.debian.net/debian/pool/main/n/nspr/nspr_4.16-1.dsc
cd nspr-4.16/
dch --local "$SUFFIX" --distribution stretch-backports "Rebuild for stretch-backports."
sbuild --build-dep-resolver=aptitude
cd ..

# Build nss from sid
dget -x http://http.debian.net/debian/pool/main/n/nss/nss_3.34-1.dsc
cd nss-3.34/
dch --local "$SUFFIX" --distribution stretch-backports "Rebuild for stretch-backports."
sbuild --build-dep-resolver=aptitude  --extra-package $WORKING_DIRECTORY/libnspr4_4.16-1${SUFFIX}1_amd64.deb --extra-package $WORKING_DIRECTORY/libnspr4-dev_4.16-1${SUFFIX}1_amd64.deb
cd ..

# Build sqlite from sid
dget -x http://http.debian.net/debian/pool/main/s/sqlite3/sqlite3_3.21.0-1.dsc
cd sqlite3-3.21.0/
dch --local "$SUFFIX" --distribution stretch-backports "Rebuild for stretch-backports."
sbuild --build-dep-resolver=aptitude --extra-package $WORKING_DIRECTORY/libnspr4_4.16-1${SUFFIX}1_amd64.deb --extra-package $WORKING_DIRECTORY/libnspr4-dev_4.16-1${SUFFIX}1_amd64.deb --extra-package $WORKING_DIRECTORY/libnss3_3.34-1${SUFFIX}1_amd64.deb --extra-package $WORKING_DIRECTORY/libnss3-dev_3.34-1${SUFFIX}1_amd64.deb
cd ..

# Build hunspell from sid
dget -x http://http.debian.net/debian/pool/main/h/hunspell/hunspell_1.6.2-1.dsc
cd hunspell-1.6.2/
dch --local "$SUFFIX" --distribution stretch-backports "Rebuild for stretch-backports."
sbuild --build-dep-resolver=aptitude
cd ..

##########################
# Build Firefox from sid #
##########################

# Put LLVM-3.9 in PATH and set RUSTUP_HOME and CARGO_HOME
cat > sbuild.rc <<SBUILDRC
$path = '/usr/lib/llvm-3.9/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games';
$build_environment = {
  'RUSTUP_HOME' => '/usr/local',
  'CARGO_HOME' => '.cargo'
};
SBUILDRC

# Get source
dget -x http://http.debian.net/debian/pool/main/f/firefox/firefox_57.0.4-1.dsc
cd firefox-57.0.4

# Remove build-dependency on rustc and cargo (we install them manually),
# downgrade build-dependencies on LLVM
patch -p0 <<PATCH
--- debian/control.in.orig  2017-11-24 13:11:11.000000000 +0100
+++ debian/control.in 2017-11-24 13:12:26.975786435 +0100
@@ -63,11 +63,9 @@
                mesa-common-dev,
                libpulse-dev,
                yasm (>= 1.1),
-               rustc (>= 1.19),
-               cargo (>= 0.20),
-               llvm-4.0-dev,
-               libclang-4.0-dev,
-               clang-4.0,
+               llvm-3.9-dev,
+               libclang-3.9-dev,
+               clang-3.9,
                zip,
                unzip,
                locales,
PATCH

# Pull servo patch for building with rust 1.23
quilt import -P debian-hacks/support-building-with-rust-1.23.patch <(curl https://github.com/servo/servo/commit/954b2cc3d882ddec8a93a9ce2be2a20e11507bec.patch | sed 's/components\//servo\/components\//g')
quilt push --fuzz 3
quilt refresh
quilt pop

# Tag backport version in changelog
dch --local "$SUFFIX" --distribution stretch-backports "Rebuild for stretch-backports."

# Build, but first install rustc and cargo using rustup
SBUILD_CONFIG=../sbuild.rc sbuild \
  --chroot-setup-commands 'apt-get install curl -y && curl https://sh.rustup.rs -sSf | RUSTUP_HOME=/usr/local/ CARGO_HOME=/usr/local sh -s - -y --no-modify-path' \
  --build-dep-resolver=aptitude \
  --extra-package $WORKING_DIRECTORY/libnspr4_4.16-1${SUFFIX}1_amd64.deb \
  --extra-package $WORKING_DIRECTORY/libnspr4-dev_4.16-1${SUFFIX}1_amd64.deb \
  --extra-package $WORKING_DIRECTORY/libnss3_3.34-1${SUFFIX}1_amd64.deb \
  --extra-package $WORKING_DIRECTORY/libnss3-dev_3.34-1${SUFFIX}1_amd64.deb \
  --extra-package $WORKING_DIRECTORY/libsqlite3-dev_3.21.0-1${SUFFIX}1_amd64.deb  \
  --extra-package $WORKING_DIRECTORY/sqlite3_*.deb \
  --extra-package $WORKING_DIRECTORY/libsqlite3-0_*.deb  \
  --extra-package $WORKING_DIRECTORY/libhunspell-dev_1.6.2-1${SUFFIX}1_amd64.deb  \
  --extra-package $WORKING_DIRECTORY/libhunspell-1.6-0_1.6.2-1${SUFFIX}1_amd64.deb
```

Afterwards, `$WORKING_DIRECTORY` should contain (among a lot of other files):

```
firefox_57.0.4-1${SUFFIX}1_amd64.deb
libhunspell-1.6-0_1.6.2-1${SUFFIX}1_amd64.deb
libnspr4_4.16-1${SUFFIX}1_amd64.deb
libnss3_3.34-1${SUFFIX}1_amd64.deb
libsqlite3-0_3.21.0-1${SUFFIX}1_amd64.deb
```

Now you should be able to install those with `dpkg` on your Debian stable.

**<time>2017-12-02</time>:** Updated to Firefox 57.0.1.
**<time>2018-01-09</time>:** Updated to Firefox 57.0.4 and added a fix for compiling with rustc 1.23.

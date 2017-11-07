---
layout: post
title: Intel ME, MINIX and Copyleft
tags: IntelME MINIX BSD GPL Copyleft
---

Andrew S. Tanenbaum, the author of the MINIX operating system, wrote [a letter to intel](http://www.cs.vu.nl/~ast/intel/).
Security researchers <time datetime="2017-08-28">recently</time> published that MINIX is used in the [Intel ME](https://www.eff.org/deeplinks/2017/05/intels-management-engine-security-hazard-and-users-need-way-disable-it), a small computer running unsupervised inside every modern Intel processor.
He described his experience with Intel and states that this event reaffirms his positive assessment of (permissive non-copyleft open source licenses like) the BSD license.
His only complaint is that Intel did not give him a heads up about them deploying his software so widely, which he would have considered polite.

Regarding licenses, I had the exact opposite reaction.
Initially, when I started reading his letter, I only expected a polite critique of Intel's behavior and how they used his project.
After reading the first paragraphs, I started to hope for him to actually question his stanza on non-copyleft licenses in light of this event.
Granted, that was probably a bit much.

But what happened instead made me feel like Rocket Raccoon with Groot in the death button scene:

<p style="text-align: center"><video src="/res/iamgroot.webm" controls playsinline></video></p>

Andrew concluded his letter by stating his view that »the Berkeley license provides the maximum amount of freedom to potential users«.
And he even found this event to be reaffirming his view.

Let's take a step back: His software is deployed in millions of computers with the goal of not giving users full control over their device.
His choice of license not only made this possible, it is also responsible for the fact that people had to _research their devices_ for years to _even know that MINIX is running on it_.
Heck, someone even had to do years of research so that _he_ knows that _his software_ is running on all these machines.
And he still thinks that this license »provides the maximum amount of freedom to potential users«.

The one freedom that comes to mind, the one freedom that his choice of license provided in this case is Intel's freedom to take other people's freedom.
Intel is in a position to control what people can do with their computers.
With his choice of license, Andrew effectively told them that they can happily use his work for that.

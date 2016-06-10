---
layout: post
title: Encrypt an existing Debian GNU/Linux installation with LUKS
tags: Debian Encryption GRUB LUKS LVM
id: https://ada.adrianlang.de/existing-debian-luks
---

In the following text I‘ll provide an up-to-date description of how to setup a completely encrypted Debian, using the unstable Debian distribution from August 2010.

## Motivation
Whether you want to encrypt your system for personal, political or economic reasons, a fully encrypted system provides an excellent protection for data – together with encrypted communication (HTTPS for web traffic, OTR for instant messaging, GPG for e-mail and instant messaging), which is quite common nowadays.

Encrypting only the sensitive data itself may seem like a sufficient approach, but it has some limitations and problems:

  * It is difficult to decide which data in fact is sensitive and which not. Depending an whose targeting you fear, many informations you did not take into account may provide useful hints to an attacker – private images may help identifying other people or give clues on when you were somewhere and so on.
  * Moreover you might not even know where your data is stored: Temporary files from applications and your operating system‘s swap space will probably contain copies of your data at some point in time – even after reboots.
  * A non-encrypted system provides more ways to attack you by injecting modified software. However, even a so-called »full-encrypted system« leaves some attack possibilities: The kernel itself and the initrd (some basic files and drivers the kernel needs to access (i. e., uncrypt) the file system) are not encrypted and could be modified.

## Technology
The current state of the art for disk encryption under Linux is [LUKS](https://en.wikipedia.org/LUKS) as implemented by cryptsetup using dm-crypt. It‘s free software, included in Debian and other distributions, encrypts securely and runs transparently, stable and fast (Actually, access to encrypted devices is not really slower).

GRUB 2 is stable and default since Debian Squeeze. It works fine with LUKS.

## Setting

I want to encrypt the Debian installation on my netbook. I have the following partitions on my 150 GB hard disk:

  - Some windows recovery I do not need (4 GB)
  - Windows (40 GB)
  - An empty partition (52 GB)
  - An extended partition (52 GB) which contains
    - The root file system of my Debian (50 GB)
    - The swap of my Debian (2 GB)

This is quite an unusual partition layout, but it somehow got that way. What I want is the following:

  - /boot, the place for the kernel and the initrd (4 GB; which is way too much; 1 GB is more than enough)
  - Windows (40 GB)
  - An encrypted partition (104 GB) which contains
    - A <abbr title="Logical Volume Manager Volume Group, multiple (logical) partitions in one (physical) partition">LVM VG</abbr> (104 GB) which contains
      - The swap of my Debian (2 GB; See [Ubuntu FAQ](https://help.ubuntu.com/community/SwapFaq) for a guide on swap sizes)
      - The root file system of my Debian (102 GB)

Using LVM is quite a necessity to create multiple partitions in one encryption container. Alternatively, every partition could get an own encryption container. Note that a physical device (a hard disk) can only contain four partitions. If you need more, you have to use extended partitions or LVM.

## Realization ##

### Parameters

  * `$PARTITION`: The partition which is going to hold the encrypted container; `/dev/sda3` in my case
  * `$CRYPTCONTAINER`: The name of the encryption container; `encrypted` in my case
  * `$GROUP`: The name of the LVM group; `group` in my case
  * `$LV_SWAP`: The name of the logical swap partition: `lv_swap` in my case
  * `$LV_ROOT`: The name of the logical root partition: `lv_root` in my case
  * `$SWAP_SIZE`: The size of the swap partition: `2G` in my case

```
# The hard disk where everything is going to happen
export HDD=/dev/sda

# The partition which is going to hold the encrypted container
export CRYPTPARTITION=${HDD}3

# The boot partition
export BOOT=${HDD}1

# Some names; they are not important, but use the same name everywhere
# The name of the encryption container
export CRYPTCONTAINER=encrypted
# The name of the LVM group
export GROUP=group
# The name of the logical swap partition
export LV_SWAP=lv_swap
# The name of the logical root partition
export LV_ROOT=lv_root

# The size of the swap partition; use your RAM size as a rough estimate
export SWAP_SIZE=2G
```

### Preparing the partitions

Note: If you need to create partitions in the first place, use `cfdisk`.

To increase the encryption strength, the partition should contain random data before creating the encryption container. This is done with `badblocks`, which checks for defect sectors at the same time. `badblocks` will destroy your partition (which will happen anyway soon), so double-check that you have the right `$PARTITION`. Note that this will take some hours.

After that, the various containers are created: first the encryption container. While doing this you have to enter the first (LUKS can handle up to eight keys) key – do not loose this or you are lost. You should create a strong, random key for this purpose – use one of the various key generators like [this web-based tool](http://www.mytsoftware.com/dailyproject/PassGen/PassGen.html) or [pwgen](http://packages.debian.org/pwgen), for example. After creating the container, we immediately open, i. e. unlock it to create the LVM group. Now the volume group and the logical partitions for swap and the root file system are created and formatted. Finally, we format the boot partition.

    # Install necessary packages
    aptitude install cryptsetup lvm2

    # Overwrite the target partition with random junk and check for bad blocks
    badblocks -v -w -t random $CRYPTPARTITION

    # Create the crypt container
    cryptsetup luksFormat $CRYPTPARTITION

    # Open the crypt container
    # After this step, the raw uncrypted partition is accessible as
    # /dev/mapper/$CRYPTCONTAINER
    cryptsetup luksOpen $CRYPTPARTITION $CRYPTCONTAINER

    # Create the logical volume group
    pvcreate /dev/mapper/$CRYPTCONTAINER
    vgcreate $GROUP /dev/mapper/$CRYPTCONTAINER

    # Create the logical swap partition with the desired size
    lvcreate -n $LV_SWAP $GROUP -L $SWAP_SIZE

    # Use the rest for the logical root partition
    lvcreate -n $LV_ROOT $GROUP --extents=100%FREE

    # Format both partitions
    mkfs.ext3 /dev/mapper/$GROUP-$LV_ROOT
    mkswap /dev/mapper/$GROUP-$LV_SWAP

    # Format the boot partition
    mkfs.ext3 $BOOT

## Copying the system

Now the existing system needs to be copied to the encrypted partitions. This should include everything from `/` apart from `/boot`, `/dev`, `/media`, `/mnt`, `/proc`, `/sys` and probably `/tmp`. The content of `/boot` is copied to the new boot partition `$BOOT` – the only part of the new system which is not encrypted.

    # Create a mount point for the encrypted root system and mount it
    mkdir /mnt/crypt
    mount /dev/mapper/$GROUP-$LV_ROOT /mnt/crypt/

    # Copy everything to the encrypted partition
    cp -a /bin /etc /home /lib /root /sbin /usr /var /srv /selinux /mnt/crypt

    # Create empty directories
    cd /mnt/crypt
    mkdir boot dev media mnt proc sys tmp
    chmod 1777 tmp

    # Mount the new boot partition and copy the old boot stuff
    mount $BOOT boot/
    cp -a /boot/* boot/

## Making the system bootable

Now comes the most complicated part of the installation: Making the new system bootable. In order to do this, we have to [chroot](https://en.wikipedia.org/chroot) into the encrypted system. This allows us to act as like we booted the encrypted system. Before we actually `chroot`, we bind the `/dev` and `/proc` directories into the encrypted file system. This allows the `chroot`ed system to use the running system.

    # Bind /dev and /proc
    mount -o bind /dev/ dev/
    mount -o bind /proc/ proc/

    # Do the chroot
    chroot .

Now we are in the new system. Since this is basically a copy from the old, non-encrypted installation, we need to make it familiar with the fact that it is now on a different, and moreover an encrypted partition. First of all we inform `cryptsetup` via its configuration file `/etc/crypttab` that we have something to unlock on every boot.

    # Configure cryptsetup
    echo "$CRYPTCONTAINER $CRYPTPARTITION none luks" >> /etc/crypttab

Next, the system itself has to know which partitions to use – this is described in `/etc/fstab`. A `fstab` entry may look like the following two examples:

    # /dev/sda5
    UUID=fc35c8d0-018f-4397-8be0-114924c2a6a3 /               ext3    noatime,errors=remount-ro 0       1

    /dev/sda5       /               ext3    noatime,errors=remount-ro 0       1

Both lines define the same mount, but use different ways to specify the partition: UUIDs and positions. UUIDs are used to identify partitions when they are not at the same position as they used to be. You get the UUID of an device with `blkid /dev/DEVICENAME`. To update the `fstab`, we add a new entry defining the boot partition, and fix the definitions of root and swap locations. The new `fstab` will contain the following lines:

    $BOOTPARTITION       /boot           ext3    defaults        0       0
    /dev/mapper/$GROUP-$LV_ROOT /               ext3    noatime,errors=remount-ro 0       1
    /dev/mapper/$GROUP-$LV_SWAP none            swap    sw              0       0

You may use UUIDs instead.

The next step is the actualization of the boot loader and the initramfs, since Linux will now need encryption and lvm support in its initramfs. Ideally, the system would know itself which modules are needed in the initramfs. Since we are running the system in a chroot, this autodetection would fail (It depends on `/sys` being correctly filled). Therefor, we make sure that the modules `lvm2` and `dmcrypt` are present in the initramfs even if the old system did not need them to boot, because the new system will definitely need them. The modules we need depend on `busybox`, so we install it. If you want to be able to suspend to disk, you have to specify the right resume device, i. e. your swap partition.

    # Add needed initramfs modules
    echo "lvm2
    dmcrypt" >> /etc/initramfs-tools/modules

    # Install busybox
    aptitude install busybox

    # Specify the resume device
    echo "RESUME=UUID=$SWAP_UUID" > /etc/initramfs-tools/conf.d/resume

As a security measure, we want to be able to boot the old system if the new one fails. To facilitate this, an entry for the old system should be added to the boot loader. We copy it from the old boot loader config `/boot/grub/grub.cfg` into `/etc/grub.d/40_custom`. In my case, the entry looks like the following:

    menuentry 'Debian GNU/Linux, with Linux 2.6.32-5-686' --class debian --class gnu-linux --class gnu --class os {
      insmod part_msdos
      insmod ext2
      set root='(hd0,msdos5)'
      search --no-floppy --fs-uuid --set fc35c8d0-018f-4397-8be0-114924c2a6a3
      echo  'Loading Linux 2.6.32-5-686 ...'
      linux /boot/vmlinuz-2.6.32-5-686 root=UUID=fc35c8d0-018f-4397-8be0-114924c2a6a3 ro  quiet
      echo  'Loading initial ramdisk ...'
      initrd  /boot/initrd.img-2.6.32-5-686
    }

After this preparations the boot stuff on `/boot` and in the boot sector of the hard disk can be created.

    # Create updated initrd
    update-initramfs -u

    # Update grub2 configuration
    dpkg-reconfigure grub-pc

Now the file `/boot/grub/grub.cfg` should contain a section which refers to the encrypted device. Check the line `set root=` (this should refer to your boot partition) and the `root=` part of the `linux` line (this should refer to your root partition in the LVM group). My entry looks like the following: 

    menuentry 'Debian GNU/Linux, with Linux 2.6.32-5-686' --class debian --class gnu-linux --class gnu --class os {
      insmod part_msdos
      insmod ext2
      set root='(hd0,msdos1)'
      search --no-floppy --fs-uuid --set aa6f9a0d-fe13-46e2-b544-0997533fb2d5
      echo	'Loading Linux 2.6.32-5-686 ...'
      linux	/vmlinuz-2.6.32-5-686 root=/dev/mapper/$GROUP-$LV_ROOT ro  quiet
      echo	'Loading initial ramdisk ...'
      initrd	/initrd.img-2.6.32-5-686
    }

## Booting, troubleshooting, testing

Now we are ready to boot the new system. Since we made some some quite complicated changes, you might want to make yourself familiar with the [GRUB 2 Rescue mode](http://help.ubuntu.com/community/Grub2#Rescue_Mode). Even more useful is [QEMU](https://en.wikipedia.org/QEMU), a tool which allows you to simulate for example the boot process. A [VNC](https://en.wikipedia.org/VNC) client like `tightvnc` is used to watch the simulated boot process. With these tools, you can verify your boot setup without in fact booting and hence can keep a running system.

    # Install tools
    aptitude install qemu-system xtightvncviewer

    # Emulate booting (send emulator to the background)
    qemu -hda $HDD -vnc :0 &
    # Watch boot
    vncviewer localhost

If the VNC viewer does not show a successful boot, you should not restart your system, but fix it. A boot is successful if it shows an encryption password prompt or a warning about a 64-bit Linux running on a 32-bit processor. If you reboot the system and fail to start the encrypted installation, use the following commands from your old installation to get back into the system:

    # Open the partitions
    cryptsetup luksOpen $CRYPTPARTITION $CRYPTCONTAINER
    vgscan --mknodes
    vgchange -a y

    # Create a mount point for the encrypted root system (if necessary) and mount it
    mkdir -p /mnt/crypt
    mount /dev/mapper/$GROUP-$LV_ROOT /mnt/crypt/
    cd /mnt/crypt

    # Mount boot
    mount $BOOT boot/

Now you can start again at „[Making the system bootable](#making_the_system_bootable)“.

## Cleaning up

I suppose you managed it to boot your new, shiny, encrypted system. If so, there are still things to do: First of all, we can change the initrd configuration in `/etc/initramfs-tools/initramfs.conf` from `most` modules back to `dep` – automatically detecting which modules to use. Now even `lvm2` and `dmcrypt` can be removed from the explicit modules list `/etc/initramfs-tools/modules`. Run `update-initramfs -u` afterwards.

As a final step, I want to increase the encrypted partition to the whole rest of the hard disk and remove the old, unencrypted installation. I‘ll follow a [description from the Ubuntu forum](http://ubuntuforums.org/showthread.php?p=4530641). Note that this is a quite difficult and dangerous operation, hence I created a backup of my home directory as a first measure. The whole operation took place from a gNewSense live stick. I prepared the old partition using `badblocks`. Next, I removed both the encryption container and the old partition from the partition table using `fdisk` and added a new partition taking the whole space. Then I increased the LUKS container, then the LVM group, then the logical root volume, then the file system on the volume. Finally, I booted into the system again.

    aptitude update
    aptitude install cryptsetup lvm2

    badblocks -v -w -t random /dev/sda4

    fdisk /dev/sda
    > p
    > d
    > 3
    > d
    > 4
    > n
    > 3
    > [enter]
    > [enter]
    > p
    > w

    modprobe dm-crypt

    cryptsetup luksOpen $CRYPTPARTITION $CRYPTCONTAINER

    vgscan --mknodes
    vgchange -ay

    cryptsetup resize $CRYPTCONTAINER

    pvresize /dev/mapper/$CRYPTCONTAINER

    pvchange -x y /dev/mapper/$CRYPTCONTAINER

    # Repeat this step until there is no free space left
    # Use smaller steps when there are no 4GB left anymore
    lvresize -L +4G /dev/$GROUP/$LV_ROOT

    pvchange -x n /dev/mapper/$CRYPTCONTAINER

    e2fsck -f /dev/mapper/$GROUP-$LV_ROOT
    resize2fs -p /dev/mapper/$GROUP-$LV_ROOT

Now I have a fully encrypted copy of my lovely old Debian installation. The GRUB boot entry for the old system in `/etc/grub.d/40_custom` is now dysfunctional and should be removed as well. After that, run `update-grub2`.

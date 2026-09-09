include $(TOPDIR)/rules.mk

PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=YANG

LUCI_TITLE:=LuCI interface for MiniLinux-CPE hardware and EC200 control
LUCI_DEPENDS:=+luci-base +yang-cpe-console
LUCI_PKGARCH:=all

include ../../feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature

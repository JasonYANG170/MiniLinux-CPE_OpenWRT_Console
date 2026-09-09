include $(TOPDIR)/rules.mk

PKG_NAME:=yang-cpe-console
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=YANG
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/yang-cpe-console
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=MiniLinux-CPE hardware and EC200 console
  DEPENDS:=+ubus +uci +jsonfilter +iwinfo +swconfig +block-mount +usbutils +uqmi +umbim
endef

define Package/yang-cpe-console/description
 Lightweight serial/SSH console for fan control, system telemetry,
 Ethernet/Wi-Fi state, storage and Quectel EC200 configuration.
endef

define Package/yang-cpe-console/conffiles
/etc/config/ec200
endef

define Build/Compile
endef

define Package/yang-cpe-console/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) ./files/cpectl $(1)/usr/sbin/cpectl
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/ec200.config $(1)/etc/config/ec200
endef

$(eval $(call BuildPackage,yang-cpe-console))

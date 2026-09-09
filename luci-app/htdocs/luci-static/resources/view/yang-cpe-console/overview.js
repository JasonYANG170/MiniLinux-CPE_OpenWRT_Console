'use strict';

'require view';
'require form';
'require fs';
'require ui';

function runCpectl(args) {
	return fs.exec('/usr/sbin/cpectl', args).then(function(res) {
		if (res.code !== 0)
			throw new Error(res.stderr || _('Command failed'));
		return (res.stdout || res.stderr || '').trim();
	});
}

function showError(err) {
	ui.addNotification(null, E('p', {}, [ err.message || String(err) ]), 'error');
}

return view.extend({
	load: function() {
		return Promise.all([
			runCpectl([ 'dashboard' ]).catch(function(err) { return err.message; }),
			runCpectl([ 'ec200', 'status' ]).catch(function(err) { return err.message; })
		]);
	},

	refreshOutput: function(id, args) {
		var node = document.getElementById(id);
		if (node)
			node.textContent = _('Loading…');

		return runCpectl(args).then(function(text) {
			if (node)
				node.textContent = text || _('No data');
		}).catch(showError);
	},

	setFan: function() {
		var slider = document.getElementById('cpe-fan-pwm');
		var value = slider ? slider.value : '';

		return runCpectl([ 'fan', value ]).then(function(text) {
			ui.addNotification(null, E('p', {}, [ text || _('Fan PWM updated') ]), 'info');
		}).catch(showError);
	},

	sendAt: function() {
		var input = document.getElementById('cpe-at-command');
		var output = document.getElementById('cpe-at-output');
		var command = input ? input.value.trim() : '';

		if (!/^AT[^\r\n]*$/i.test(command)) {
			showError(new Error(_('The command must begin with AT and contain no line breaks.')));
			return Promise.resolve();
		}

		output.textContent = _('Waiting for modem…');
		return runCpectl([ 'ec200', 'at', command ]).then(function(text) {
			output.textContent = text || _('No response');
		}).catch(showError);
	},

	render: function(data) {
		var m, s, o;

		m = new form.Map('ec200', _('EC200 configuration'),
			_('Save settings first, then use Apply and reconnect. Applying may briefly interrupt the mobile connection.'));
		s = m.section(form.NamedSection, 'main', 'modem', _('Mobile network'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'proto', _('Protocol'));
		o.value('qmi', 'QMI');
		o.value('mbim', 'MBIM');
		o.value('ncm', 'NCM');
		o.default = 'qmi';

		o = s.option(form.Value, 'at_port', _('AT port'));
		o.default = '/dev/ttyUSB2';
		o.rmempty = false;

		o = s.option(form.Value, 'data_device', _('QMI/MBIM device'));
		o.default = '/dev/cdc-wdm0';
		o.rmempty = false;

		o = s.option(form.Value, 'interface', _('Network interface name'));
		o.default = 'wwan';
		o.datatype = 'uciname';
		o.rmempty = false;

		o = s.option(form.Value, 'apn', _('APN'));
		o.placeholder = 'cmnet';

		o = s.option(form.Value, 'pin', _('SIM PIN'));
		o.password = true;
		o.datatype = 'and(uinteger,minlength(4),maxlength(8))';
		o.rmempty = true;

		o = s.option(form.ListValue, 'pdptype', _('PDP type'));
		o.value('ipv4', 'IPv4');
		o.value('ipv6', 'IPv6');
		o.value('ipv4v6', 'IPv4/IPv6');
		o.default = 'ipv4v6';

		o = s.option(form.ListValue, 'auth', _('Authentication'));
		o.value('none', _('None'));
		o.value('pap', 'PAP');
		o.value('chap', 'CHAP');
		o.value('both', 'PAP/CHAP');
		o.default = 'none';

		o = s.option(form.Value, 'username', _('Username'));
		o.depends('auth', 'pap');
		o.depends('auth', 'chap');
		o.depends('auth', 'both');

		o = s.option(form.Value, 'password', _('Password'));
		o.password = true;
		o.depends('auth', 'pap');
		o.depends('auth', 'chap');
		o.depends('auth', 'both');

		o = s.option(form.ListValue, 'network_mode', _('Preferred network'));
		o.value('auto', _('Automatic'));
		o.value('gsm', '2G / GSM');
		o.value('lte', '4G / LTE');
		o.default = 'auto';

		o = s.option(form.Button, '_apply_modem', _('Apply and reconnect'));
		o.inputstyle = 'apply';
		o.onclick = function() {
			return this.map.save(null, true).then(function() {
				return runCpectl([ 'ec200', 'apply' ]);
			}).then(function(text) {
				ui.addNotification(null, E('p', {}, [ text || _('EC200 configuration applied') ]), 'info');
			}).catch(showError);
		};

		return m.render().then(L.bind(function(configForm) {
			return E([], [
				E('h2', {}, [ _('MiniLinux CPE control panel') ]),
				E('div', { 'class': 'cbi-section' }, [
					E('h3', {}, [ _('System, storage, Ethernet and wireless') ]),
					E('pre', { 'id': 'cpe-dashboard', 'style': 'white-space:pre-wrap' }, [ data[0] ]),
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'click': ui.createHandlerFn(this, this.refreshOutput, 'cpe-dashboard', [ 'dashboard' ])
					}, [ _('Refresh') ])
				]),
				E('div', { 'class': 'cbi-section' }, [
					E('h3', {}, [ _('Fan PWM') ]),
					E('input', {
						'id': 'cpe-fan-pwm',
						'type': 'range',
						'min': '0',
						'max': '255',
						'value': '128',
						'input': function(ev) {
							var value = document.getElementById('cpe-fan-value');
							if (value)
								value.textContent = ev.target.value;
						}
					}),
					E('span', { 'id': 'cpe-fan-value', 'style': 'margin:0 1em' }, [ '128' ]),
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, this.setFan)
					}, [ _('Set fan speed') ])
				]),
				E('div', { 'class': 'cbi-section' }, [
					E('h3', {}, [ _('EC200 status') ]),
					E('pre', { 'id': 'cpe-ec200-status', 'style': 'white-space:pre-wrap' }, [ data[1] ]),
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'click': ui.createHandlerFn(this, this.refreshOutput, 'cpe-ec200-status', [ 'ec200', 'status' ])
					}, [ _('Refresh modem status') ])
				]),
				configForm,
				E('div', { 'class': 'cbi-section' }, [
					E('h3', {}, [ _('Custom EC200 AT command') ]),
					E('input', { 'id': 'cpe-at-command', 'class': 'cbi-input-text', 'value': 'AT+CSQ' }),
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'style': 'margin-left:1em',
						'click': ui.createHandlerFn(this, this.sendAt)
					}, [ _('Send') ]),
					E('pre', { 'id': 'cpe-at-output', 'style': 'white-space:pre-wrap' })
				])
			]);
		}, this));
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});

'use strict';

'require view';
'require form';
'require fs';
'require ui';
'require poll';

function runCpectl(args) {
	return fs.exec('/usr/sbin/cpectl', args).then(function(res) {
		if (res.code !== 0) throw new Error(res.stderr || _('Command failed'));
		return (res.stdout || res.stderr || '').trim();
	});
}

function readMetrics() {
	return runCpectl([ 'metrics' ]).then(function(text) { return JSON.parse(text); });
}

function showError(err) {
	ui.addNotification(null, E('p', {}, [ err.message || String(err) ]), 'error');
}

function clamp(value, min, max) {
	value = Number(value);
	return isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}

function formatUptime(seconds) {
	seconds = Math.max(0, Number(seconds) || 0);
	var days = Math.floor(seconds / 86400);
	var hours = Math.floor((seconds % 86400) / 3600);
	var minutes = Math.floor((seconds % 3600) / 60);
	return (days ? days + '天 ' : '') + hours + '时 ' + minutes + '分';
}

function statusPill(id, label) {
	return E('div', { 'class': 'ycpe-status' }, [
		E('span', { 'id': id, 'class': 'ycpe-dot' }), E('span', {}, [ label ]),
		E('strong', { 'id': id + '-text' }, [ '--' ])
	]);
}

function gauge(id, title, accent) {
	return E('div', { 'class': 'ycpe-card ycpe-gauge-card' }, [
		E('div', { 'class': 'ycpe-card-title' }, [ title ]),
		E('div', { 'id': id, 'class': 'ycpe-gauge', 'data-accent': accent }, [
			E('div', { 'class': 'ycpe-gauge-core' }, [
				E('strong', { 'id': id + '-value' }, [ '--' ]),
				E('small', { 'id': id + '-unit' }, [ '%' ])
			])
		]),
		E('div', { 'id': id + '-hint', 'class': 'ycpe-hint' }, [ '等待数据' ])
	]);
}

function chartCard(id, title, legendA, legendB) {
	return E('div', { 'class': 'ycpe-card ycpe-chart-card' }, [
		E('div', { 'class': 'ycpe-chart-head' }, [
			E('div', { 'class': 'ycpe-card-title' }, [ title ]),
			E('div', { 'class': 'ycpe-legend' }, [
				E('span', { 'class': 'ycpe-key ycpe-key-a' }, [ legendA ]),
				E('span', { 'class': 'ycpe-key ycpe-key-b' }, [ legendB ])
			])
		]),
		E('canvas', { 'id': id, 'width': '640', 'height': '190' }),
		E('div', { 'id': id + '-summary', 'class': 'ycpe-chart-summary' }, [ '--' ])
	]);
}

return view.extend({
	load: function() {
		return readMetrics().catch(function() { return {}; });
	},

	setText: function(id, text) {
		var node = this.root && this.root.querySelector('#' + id);
		if (node) node.textContent = text;
	},

	setGauge: function(id, percent, value, unit, hint) {
		var node = this.root && this.root.querySelector('#' + id);
		if (!node) return;
		percent = clamp(percent, 0, 100);
		var accent = node.getAttribute('data-accent') || '#19c37d';
		node.style.background = 'conic-gradient(' + accent + ' ' + (percent * 3.6) + 'deg, rgba(127,127,127,.16) 0deg)';
		this.setText(id + '-value', value); this.setText(id + '-unit', unit); this.setText(id + '-hint', hint);
	},

	setStatus: function(id, active, text) {
		var dot = this.root && this.root.querySelector('#' + id);
		if (dot) dot.className = 'ycpe-dot ' + (active ? 'is-up' : 'is-down');
		this.setText(id + '-text', text);
	},

	pushHistory: function(series, value) {
		series.push(Math.max(0, Number(value) || 0));
		if (series.length > 60) series.shift();
	},

	drawChart: function(id, first, second, maxValue, suffix) {
		var canvas = this.root && this.root.querySelector('#' + id);
		if (!canvas || !canvas.getContext) return;
		var ctx = canvas.getContext('2d'), width = canvas.width, height = canvas.height;
		var left = 42, right = 10, top = 12, bottom = 25;
		var plotW = width - left - right, plotH = height - top - bottom;
		maxValue = Math.max(1, Number(maxValue) || 1);
		ctx.clearRect(0, 0, width, height); ctx.font = '11px sans-serif'; ctx.fillStyle = '#87919e';
		ctx.strokeStyle = 'rgba(127,127,127,.20)'; ctx.lineWidth = 1;
		for (var row = 0; row <= 4; row++) {
			var y = top + plotH * row / 4;
			ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke();
			ctx.fillText(Math.round(maxValue * (4 - row) / 4) + suffix, 2, y + 4);
		}
		function line(values, color) {
			ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2.5;
			for (var i = 0; i < values.length; i++) {
				var x = left + plotW * i / Math.max(59, values.length - 1);
				var py = top + plotH * (1 - Math.min(maxValue, values[i]) / maxValue);
				if (i === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py);
			}
			ctx.stroke();
		}
		line(first, '#19c37d'); line(second, '#3b82f6');
		ctx.fillStyle = '#87919e'; ctx.fillText('60秒前', left, height - 5); ctx.fillText('现在', width - 34, height - 5);
	},

	updateMetrics: function(data) {
		data = data || {};
		var fan = clamp(data.fan, 0, 255);
		var signalPercent = clamp((Number(data.wifi_signal) + 100) * 2, 0, 100);
		this.setGauge('ycpe-cpu', data.cpu, Math.round(data.cpu || 0), '%', '负载 ' + ((Number(data.load100) || 0) / 100).toFixed(2));
		this.setGauge('ycpe-memory', data.memory, Math.round(data.memory || 0), '%', '内存占用');
		this.setGauge('ycpe-storage', data.disk, Math.round(data.disk || 0), '%', '根文件系统');
		this.setGauge('ycpe-fan', fan * 100 / 255, Math.round(fan), '/255', 'GPIO46 PWM');
		this.setGauge('ycpe-wifi', signalPercent, Number(data.wifi_signal) || -100, 'dBm', '无线信号');
		this.setGauge('ycpe-ports', Number(data.ports_up) * 100 / Math.max(1, Number(data.ports_total)), Number(data.ports_up) || 0, '/3', '已连接网口');
		this.setText('ycpe-uptime', formatUptime(data.uptime));
		this.setText('ycpe-temp', Number(data.temperature) >= 0 ? data.temperature + ' °C' : '无传感器');
		this.setStatus('ycpe-ec200', Number(data.ec200) === 1, Number(data.ec200) === 1 ? '已识别' : '未识别');
		this.setStatus('ycpe-tf', Number(data.tf) === 1, Number(data.tf) === 1 ? '已挂载' : '未识别');
		this.setStatus('ycpe-usb', Number(data.usb) === 1, Number(data.usb) === 1 ? '已识别' : '未识别');
		this.pushHistory(this.history.cpu, data.cpu); this.pushHistory(this.history.memory, data.memory);
		var current = { time: Date.now() / 1000, lanRx: Number(data.lan_rx) || 0, lanTx: Number(data.lan_tx) || 0, mobileRx: Number(data.mobile_rx) || 0, mobileTx: Number(data.mobile_tx) || 0 };
		var lanRate = 0, mobileRate = 0;
		if (this.lastTraffic && current.time > this.lastTraffic.time) {
			var delta = current.time - this.lastTraffic.time;
			lanRate = Math.max(0, (current.lanRx + current.lanTx - this.lastTraffic.lanRx - this.lastTraffic.lanTx) / delta / 1024);
			mobileRate = Math.max(0, (current.mobileRx + current.mobileTx - this.lastTraffic.mobileRx - this.lastTraffic.mobileTx) / delta / 1024);
		}
		this.lastTraffic = current; this.pushHistory(this.history.lan, lanRate); this.pushHistory(this.history.mobile, mobileRate);
		this.drawChart('ycpe-resource-chart', this.history.cpu, this.history.memory, 100, '%');
		var trafficMax = Math.max(10, Math.ceil(Math.max.apply(null, this.history.lan.concat(this.history.mobile)) / 10) * 10);
		this.drawChart('ycpe-traffic-chart', this.history.lan, this.history.mobile, trafficMax, 'K');
		this.setText('ycpe-resource-chart-summary', 'CPU ' + Math.round(data.cpu || 0) + '%　内存 ' + Math.round(data.memory || 0) + '%');
		this.setText('ycpe-traffic-chart-summary', 'LAN ' + lanRate.toFixed(1) + ' KB/s　4G ' + mobileRate.toFixed(1) + ' KB/s');
		var slider = this.root && this.root.querySelector('#cpe-fan-pwm');
		if (slider && !slider.matches(':active')) { slider.value = fan; this.setText('cpe-fan-value', fan); }
	},

	refreshOutput: function(id, args) {
		var node = document.getElementById(id); if (node) node.textContent = _('Loading…');
		return runCpectl(args).then(function(text) { if (node) node.textContent = text || _('No data'); }).catch(showError);
	},

	setFan: function() {
		var slider = document.getElementById('cpe-fan-pwm');
		return runCpectl([ 'fan', slider ? slider.value : '0' ]).then(function(text) {
			ui.addNotification(null, E('p', {}, [ text || _('Fan PWM updated') ]), 'info');
		}).catch(showError);
	},

	sendAt: function() {
		var input = document.getElementById('cpe-at-command'), output = document.getElementById('cpe-at-output');
		var command = input ? input.value.trim() : '';
		if (!/^AT[^\r\n]*$/i.test(command)) { showError(new Error('指令必须以 AT 开头且不能包含换行。')); return Promise.resolve(); }
		output.textContent = '正在等待模块响应…';
		return runCpectl([ 'ec200', 'at', command ]).then(function(text) { output.textContent = text || '模块没有返回内容'; }).catch(showError);
	},

	makeConfigForm: function() {
		var m = new form.Map('ec200', 'EC200 配置', '保存后点击“应用并重连”，移动网络会短暂中断。');
		var s = m.section(form.NamedSection, 'main', 'modem', '移动网络'); s.anonymous = true;
		var o = s.option(form.ListValue, 'proto', '协议'); o.value('qmi', 'QMI'); o.value('mbim', 'MBIM'); o.value('ncm', 'NCM'); o.default = 'qmi';
		o = s.option(form.Value, 'at_port', 'AT 端口'); o.default = '/dev/ttyUSB2'; o.rmempty = false;
		o = s.option(form.Value, 'data_device', 'QMI/MBIM 设备'); o.default = '/dev/cdc-wdm0'; o.rmempty = false;
		o = s.option(form.Value, 'interface', '网络接口名'); o.default = 'wwan'; o.datatype = 'uciname'; o.rmempty = false;
		o = s.option(form.Value, 'apn', 'APN'); o.placeholder = 'cmnet';
		o = s.option(form.Value, 'pin', 'SIM PIN'); o.password = true; o.datatype = 'and(uinteger,minlength(4),maxlength(8))'; o.rmempty = true;
		o = s.option(form.ListValue, 'pdptype', 'PDP 类型'); o.value('ipv4', 'IPv4'); o.value('ipv6', 'IPv6'); o.value('ipv4v6', 'IPv4/IPv6'); o.default = 'ipv4v6';
		o = s.option(form.ListValue, 'auth', '鉴权'); o.value('none', '无'); o.value('pap', 'PAP'); o.value('chap', 'CHAP'); o.value('both', 'PAP/CHAP'); o.default = 'none';
		o = s.option(form.Value, 'username', '用户名'); o.depends('auth', 'pap'); o.depends('auth', 'chap'); o.depends('auth', 'both');
		o = s.option(form.Value, 'password', '密码'); o.password = true; o.depends('auth', 'pap'); o.depends('auth', 'chap'); o.depends('auth', 'both');
		o = s.option(form.ListValue, 'network_mode', '首选网络'); o.value('auto', '自动'); o.value('gsm', '2G / GSM'); o.value('lte', '4G / LTE'); o.default = 'auto';
		o = s.option(form.Button, '_apply_modem', '应用并重连'); o.inputstyle = 'apply';
		o.onclick = function() {
			return this.map.save(null, true).then(function() { return runCpectl([ 'ec200', 'apply' ]); })
				.then(function(text) { ui.addNotification(null, E('p', {}, [ text || 'EC200 配置已应用' ]), 'info'); }).catch(showError);
		};
		return m;
	},

	render: function(data) {
		this.history = { cpu: [], memory: [], lan: [], mobile: [] }; this.lastTraffic = null;
		return this.makeConfigForm().render().then(L.bind(function(configForm) {
			var root = E('div', { 'class': 'ycpe-dashboard' }, [
				E('link', { 'rel': 'stylesheet', 'href': L.resource('yang-cpe-console/dashboard.css') }),
				E('div', { 'class': 'ycpe-hero' }, [
					E('div', {}, [ E('h2', {}, [ 'MiniLinux-CPE 数据看板' ]), E('p', {}, [ 'YANG-RouterOS · 实时硬件与网络监控' ]) ]),
					E('div', { 'class': 'ycpe-hero-meta' }, [ E('span', {}, [ '运行时间 ', E('strong', { 'id': 'ycpe-uptime' }, [ '--' ]) ]), E('span', {}, [ '温度 ', E('strong', { 'id': 'ycpe-temp' }, [ '--' ]) ]) ])
				]),
				E('div', { 'class': 'ycpe-gauges' }, [
					gauge('ycpe-cpu', 'CPU', '#19c37d'), gauge('ycpe-memory', '内存', '#3b82f6'), gauge('ycpe-storage', '存储', '#a855f7'),
					gauge('ycpe-fan', '风扇', '#f59e0b'), gauge('ycpe-wifi', '无线', '#06b6d4'), gauge('ycpe-ports', '网口', '#ef4444')
				]),
				E('div', { 'class': 'ycpe-charts' }, [ chartCard('ycpe-resource-chart', '资源趋势', 'CPU', '内存'), chartCard('ycpe-traffic-chart', '实时流量', 'LAN', '4G') ]),
				E('div', { 'class': 'ycpe-card' }, [ E('div', { 'class': 'ycpe-card-title' }, [ '设备状态' ]), E('div', { 'class': 'ycpe-status-grid' }, [ statusPill('ycpe-ec200', 'EC200 4G'), statusPill('ycpe-tf', 'TF 卡'), statusPill('ycpe-usb', 'USB 存储') ]) ]),
				E('div', { 'class': 'ycpe-card' }, [ E('div', { 'class': 'ycpe-card-title' }, [ '风扇控制' ]), E('div', { 'class': 'ycpe-fan-row' }, [
					E('input', { 'id': 'cpe-fan-pwm', 'type': 'range', 'min': '0', 'max': '255', 'value': '0', 'input': L.bind(function(ev) { this.setText('cpe-fan-value', ev.target.value); }, this) }),
					E('strong', { 'id': 'cpe-fan-value' }, [ '0' ]), E('button', { 'class': 'cbi-button cbi-button-apply', 'click': ui.createHandlerFn(this, this.setFan) }, [ '设置 PWM' ])
				]) ]),
				E('details', { 'class': 'ycpe-card ycpe-details' }, [ E('summary', {}, [ 'EC200 详细状态与配置' ]),
					E('div', { 'class': 'ycpe-detail-actions' }, [ E('button', { 'class': 'cbi-button cbi-button-action', 'click': ui.createHandlerFn(this, this.refreshOutput, 'cpe-ec200-status', [ 'ec200', 'status' ]) }, [ '读取模块状态' ]) ]),
					E('pre', { 'id': 'cpe-ec200-status' }, [ '点击按钮读取 EC200 详细信息' ]), configForm,
					E('div', { 'class': 'ycpe-at-row' }, [ E('input', { 'id': 'cpe-at-command', 'class': 'cbi-input-text', 'value': 'AT+CSQ' }), E('button', { 'class': 'cbi-button cbi-button-action', 'click': ui.createHandlerFn(this, this.sendAt) }, [ '发送 AT 指令' ]) ]),
					E('pre', { 'id': 'cpe-at-output' })
				])
			]);
			this.root = root; this.updateMetrics(data);
			poll.add(L.bind(function() { return readMetrics().then(L.bind(this.updateMetrics, this)).catch(function() {}); }, this), 3);
			return root;
		}, this));
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});

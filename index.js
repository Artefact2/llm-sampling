"use strict";

let prompts;
let max_tokens, vbar_width;

const samplers = {
	temperature: (tokens, probs) => {
		if(tokens.length <= 1) return probs;
		let T = $("input#temperature-T").val();
		if($("input#temperature-dyn").prop('checked')) {
			let range = Math.min(T, $("input#temperature-dyn-range").val());
			let expo = $("input#temperature-dyn-exponent").val();
			/* reference: https://github.com/YellowRoseCx/koboldcpp-rocm/blob/main/llama.cpp#L10652-L10670 */
			probs = normalize(tokens, probs);
			let max_entropy = -Math.log(1.0 / tokens.length), entropy = 0.0;
			for(let tok of tokens) {
				entropy -= probs[tok] * Math.log(probs[tok]);
			}
			T = (T - range) + 2 * range * Math.pow(entropy / max_entropy, expo);
		}
		T = 1.0 / T;
		for(let tok of tokens) {
			probs[tok] = Math.pow(probs[tok], T);
		}
		let sf = $("input#temperature-SS-SF").val();
		if($("input#temperature-SS").prop('checked') && sf > 0) {
			/* reference: https://github.com/YellowRoseCx/koboldcpp-rocm/blob/main/llama.cpp#L10689-L10699 */
			for(let tok of tokens) {
				probs[tok] = probs[tokens[0]] * Math.exp(
					-sf * Math.pow(Math.log(probs[tok] / probs[tokens[0]]), 2.0)
				);
			}
		}
		return probs;
	},
	top_k: (tokens, probs) => {
		let k = $("input#top_k").closest('div.alert').find('input[type="range"]').val();
		let chart = $("input#top_k").closest('div.alert').find('div.chart').empty()[0], bar;
		let i = 0;
		let cols = max_tokens;
		for(let tok of tokens) {
			bar = document.createElement('div');
			let p = probs[tok] / probs[tokens[0]];
			bar.setAttribute('style', vbar_width
					 + 'height: calc(' + (100.0 * p).toFixed(2)
					 + '% + 1px); top: calc(' + (100.0 * (1.0 - p)).toFixed(2)
					 + '% - 1px); left: ' + (100.0 * i / cols).toFixed(2) + '%;');
			bar.classList.add('vbar');
			chart.appendChild(bar);
			if(++i > k) {
				delete probs[tok];
			}
		}
		bar = document.createElement('div');
		bar.setAttribute('style', 'height: 100%; top: 0; left: '
				 + (100.0 * k / 50).toFixed(2) + '%;');
		bar.classList.add('cutoff');
		chart.appendChild(bar);
		return probs;
	},
	top_p: (tokens, probs) => {
		let p = $("input#top_p").closest('div.alert').find('input[type="range"]').val();
		let chart = $("input#top_p").closest('div.alert').find('div.chart').empty()[0], bar;
		let i = 0, P = 0.0;
		probs = normalize(tokens, probs);
		for(let tok of tokens) {
			bar = document.createElement('div');
			bar.classList.add('vbar');
			bar.setAttribute('style', vbar_width
					 + 'left: ' + (100 * i / max_tokens).toFixed(2)
					 + '%; top: calc(' + (100.0 * P).toFixed(2)
					 + '% - 1px); height: calc(' + (100.0 * probs[tok]).toFixed(2) + '% + 1px);');
			chart.appendChild(bar);
			bar = document.createElement('div');
			bar.classList.add('vbar');
			bar.classList.add('vbar_top_p');
			bar.setAttribute('style', vbar_width
					 + 'left: ' + (100 * i / max_tokens).toFixed(2)
					 + '%; top: calc(' + (100.0 * (P + probs[tok])).toFixed(2)
					 + '% - 1px); height: calc(' + (100.0 * (1.0 - P - probs[tok])).toFixed(2) + '% + 1px);');
			chart.appendChild(bar);
			P += probs[tok];
			i += 1;
			if(P - probs[tok] > p) {
				delete probs[tok];
			}
		}
		bar = document.createElement('div');
		bar.setAttribute('style', 'width: 100%; left: 0; height: '
				 + (100.0 * (1.0 - p)).toFixed(2) + '%; top: '
				 + (100.0 * p).toFixed(2) + '%;');
		bar.classList.add('cutoff');
		chart.appendChild(bar);
		return probs;
	},
	min_p: (tokens, probs) => {
		if(tokens.length === 0) return probs;
		let p = $("input#min_p").closest('div.alert').find('input[type="range"]').val();
		let chart = $("input#min_p").closest('div.alert').find('div.chart').empty()[0], bar;
		let cols = max_tokens;
		let cutoff = probs[tokens[0]] * p;
		let i = 0;
		for(let tok of tokens) {
			bar = document.createElement('div');
			let p = probs[tok] / probs[tokens[0]];
			bar.setAttribute('style', vbar_width
					 + 'height: calc(' + (100.0 * p).toFixed(2)
					 + '% + 1px); top: calc(' + (100.0 * (1.0 - p)).toFixed(2)
					 + '% - 1px); left: ' + (100.0 * i / cols).toFixed(2) + '%;');
			bar.classList.add('vbar');
			chart.appendChild(bar);
			if(probs[tok] < cutoff) {
				delete probs[tok];
			}
			++i;
		}
		bar = document.createElement('div');
		bar.setAttribute('style', 'width: 100%; left: 0; height: '
				 + (100.0 * p).toFixed(2) + '%; top: '
				 + (100.0 * (1.0 - p)).toFixed(2) + '%;');
		bar.classList.add('cutoff');
		chart.appendChild(bar);
		return probs;
	},
	top_a: (tokens, probs) => {
		if(tokens.length === 0) return probs;
		let a = $("input#top_a").closest('div.alert').find('input[type="range"]').val();
		let chart = $("input#top_a").closest('div.alert').find('div.chart').empty()[0], bar;
		probs = normalize(tokens, probs);
		let cutoff = Math.pow(probs[tokens[0]], 2.0) * a;
		let i = 0;
		for(let tok of tokens) {
			bar = document.createElement('div');
			let height = probs[tok] / probs[tokens[0]];
			bar.setAttribute('style', vbar_width
					 + 'height: calc(' + (100.0 * height).toFixed(2)
					 + '% + 1px); top: calc(' + (100.0 * (1.0 - height)).toFixed(2)
					 + '% - 1px); left: ' + (100.0 * i / max_tokens).toFixed(2) + '%;');
			bar.classList.add('vbar');
			chart.appendChild(bar);
			bar = document.createElement('div');
			let extra_height = (probs[tok] / Math.pow(probs[tokens[0]], 2.0) - probs[tok] / probs[tokens[0]]);
			bar.setAttribute('style', vbar_width
					 + 'height: ' + (100.0 * extra_height).toFixed(2)
					 + '%; top: ' + (100.0 * (1.0 - height - extra_height)).toFixed(2)
					 + '%; left: ' + (100.0 * i / max_tokens).toFixed(2) + '%;');
			bar.classList.add('vbar');
			bar.classList.add('vbar_top_a');
			chart.appendChild(bar);
			if(probs[tok] < cutoff) {
				delete probs[tok];
			}
			++i;
		}
		bar = document.createElement('div');
		bar.setAttribute('style', 'width: 100%; left: 0; height: '
				 + (100.0 * a).toFixed(2) + '%; top: '
				 + (100.0 * (1.0 - a)).toFixed(2) + '%;');
		bar.classList.add('cutoff');
		chart.appendChild(bar);
		return probs;
	},
	tfs_z: (tokens, probs) => {
		if(tokens.length <= 2) return probs;
		let z = $("input#tfs_z").closest('div.alert').find('input[type="range"]').val();
		let chart = $("input#tfs_z").closest('div.alert').find('div.chart').empty()[0], bar;
		let d1 = [], d2 = [], d2_val, d2_sum = 0.0, N = tokens.length;
		for(let i = 0; i < tokens.length - 1; ++i) {
			d1.push(probs[tokens[i]] - probs[tokens[i+1]]);
		}
		for(let i = 0; i < tokens.length - 2; ++i) {
			d2.push(d2_val = Math.abs(d1[i] - d1[i+1]));
			d2_sum += d2_val;
		}
		let cutoff = d2_sum * z, total = 0.0;
		for(let i = 0; i < tokens.length; ++i) {
			if(i < d2.length) {
				bar = document.createElement('div');
				let height = d2[i] / d2_sum;
				bar.setAttribute('style', vbar_width
						 + 'height: calc(' + (100.0 * height).toFixed(2)
						 + '% + 1px); top: calc(' + (100.0 * (total / d2_sum)).toFixed(2)
						 + '% - 1px); left: ' + (100.0 * i / max_tokens).toFixed(2) + '%;');
				bar.classList.add('vbar');
				bar.classList.add('vbar_tfs_z2');
				chart.appendChild(bar);
				bar = document.createElement('div');
				bar.setAttribute('style', vbar_width
						 + 'height: ' + (100.0 * (1 - height)).toFixed(2)
						 + '%; top: ' + (100.0 * (total / d2_sum + height)).toFixed(2)
						 + '%; left: ' + (100.0 * i / max_tokens).toFixed(2) + '%;');
				bar.classList.add('vbar');
				bar.classList.add('vbar_tfs_z2s');
				chart.appendChild(bar);
				total += d2[i];
			}
			if(i >= 1 && total > cutoff) {
				delete probs[tokens[i]];
			}
		}
		bar = document.createElement('div');
		bar.setAttribute('style', 'width: 100%; left: 0; height: '
				 + (100.0 * (1.0 - z)).toFixed(2) + '%; top: '
				 + (100.0 * z).toFixed(2) + '%;');
		bar.classList.add('cutoff');
		chart.appendChild(bar);
		return probs;
	},
	typ_p: (tokens, probs) => {
		let p = $("input#typ_p").closest('div.alert').find('input[type="range"]').val();
		let chart = $("input#typ_p").closest('div.alert').find('div.chart').empty()[0], bar;
		let tok_shifted = [], total_entropy = 0.0, P = 0.0, i = 0;
		probs = normalize(tokens, probs);
		for(let tok of tokens) {
			let l = -Math.log(probs[tok]);
			total_entropy += probs[tok] * l;
			tok_shifted.push([ tok, l ]);
		}
		for(let i in tok_shifted) {
			tok_shifted[i][1] = Math.abs(tok_shifted[i][1] - total_entropy);
		}
		tok_shifted.sort((a, b) => a[1] - b[1]);
		for(let i in tok_shifted) {
			let tok = tok_shifted[i][0];
			bar = document.createElement('div');
			bar.classList.add('vbar');
			bar.setAttribute('style', vbar_width
					 + 'left: ' + (100 * i / max_tokens).toFixed(2)
					 + '%; top: calc(' + (100.0 * P).toFixed(2)
					 + '% - 1px); height: calc(' + (100.0 * probs[tok]).toFixed(2) + '% + 1px);');
			chart.appendChild(bar);
			bar = document.createElement('div');
			bar.classList.add('vbar');
			bar.classList.add('vbar_top_p');
			bar.setAttribute('style', vbar_width
					 + 'left: ' + (100 * i / max_tokens).toFixed(2)
					 + '%; top: calc(' + (100.0 * (P + probs[tok])).toFixed(2)
					 + '% - 1px); height: calc(' + (100.0 * (1.0 - P - probs[tok])).toFixed(2) + '% + 1px);');
			chart.appendChild(bar);
			P += probs[tok];
			if(P - probs[tok] > p) {
				delete probs[tok];
			}
		}
		bar = document.createElement('div');
		bar.setAttribute('style', 'width: 100%; left: 0; height: '
				 + (100.0 * (1.0 - p)).toFixed(2) + '%; top: '
				 + (100.0 * p).toFixed(2) + '%;');
		bar.classList.add('cutoff');
		chart.appendChild(bar);
		return probs;
	},
};

const normalize = (tokens, probs) => {
	let sum = 0.0;
	for(let t of tokens) {
		sum += probs[t];
	}
	for (let t of tokens) {
		probs[t] /= sum;
	}
        return probs;
};

const update_prompt = () => {
	let s = $("select#prompts");
	let prompt = s.children()[s.val()].textContent;
	s.closest('div.row').find('label')[0].textContent = prompt;
	update_sample();
};

const update_sample = () => {
	let i = $("select#prompts").val();
	let tbody = $("div#retained tbody").empty()[0];
	let sum = 0.0;
	let probs = JSON.parse(JSON.stringify(prompts[i][1]));
	$("div#samplers div.alert:has(h3 > input:checked)").each((idx, el) => {
		let sname = $(el).find('input:checked').prop('id');
		probs = samplers[sname](Object.keys(probs), probs);
	});
	let tokens = Object.keys(probs);
	probs = normalize(tokens, probs);
	let pcf = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 3, minimumFractionDigits: 3 });
	for(let t of tokens) {
		let tr = document.createElement('tr');
		let td = document.createElement('td');
		tbody.appendChild(tr);
		tr.appendChild(td);
		td.textContent = t;
		td = document.createElement('td');
		tr.appendChild(td);
		td.textContent = pcf.format(probs[t]);
		td = document.createElement('td');
		tr.appendChild(td);
		let div = document.createElement('div');
		td.appendChild(div);
		td.classList.add('align-middle');
		div.classList.add('progress');
		let pbar = document.createElement('div');
		div.appendChild(pbar);
		pbar.classList.add('progress-bar');
		pbar.classList.add('bg-primary');
		pbar.setAttribute('style', 'width: ' + (100.0 * probs[t] / probs[tokens[0]]).toFixed(2) + '%;')
	}
};

$(() => {
	$.get("out.json", data => {
		prompts = data;
		let select = $("select#prompts"), option;
		for(let i in prompts) {
			option = document.createElement('option');
			option.setAttribute('value', i);
			option.textContent = prompts[i][0] + ' _____';
			select.append(option);
		}
		select.val(0).change().trigger('input');
	});

	let types = [ "range", "text" ];
	for(let i in types) {
		$("div#samplers input[type='" + types[i] + "']").on('input', e => {
			let v = $(e.target).val();
			$(e.target).closest('div.row').find('input[type="' + types[1-i] + '"]').val(v);
		});
	}

	max_tokens = $("input#top_k").closest('div.alert').find('input[type="range"]').attr('max');
	vbar_width = 'width: calc(' + (100.0 / max_tokens).toFixed(2) + '% - 1px);';

	$("[data-bs-toggle='tooltip']").each((i, e) => new bootstrap.Tooltip(e));
	$("select#prompts").on('change', update_prompt);
	$("select#prompts").on('input', update_prompt);
	$("div#samplers input").on('input', update_sample);
	$("div#samplers").sortable({ update: update_sample });
});

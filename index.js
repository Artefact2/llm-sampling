let prompts;

const samplers = {
	temperature: (tokens, probs) => {
		let T = 1.0 / $("input#temperature").closest('div.alert').find('input[type="range"]').val();
		for(let tok of tokens) {
			probs[tok] = Math.pow(probs[tok], T);
		}
		return probs;
	},
	top_k: (tokens, probs) => {
		let k = $("input#top_k").closest('div.alert').find('input[type="range"]').val();
		let i = 0;
		for(let tok of tokens) {
			if(++i > k) {
				delete probs[tok];
			}
		}
		return probs;
	},
	top_p: (tokens, probs) => {
		let p = $("input#top_p").closest('div.alert').find('input[type="range"]').val();
		let i = 0, P = 0.0;
		for(let tok of tokens) {
			if(P >= p) {
				delete probs[tok];
			} else {
				P += probs[tok];
			}
		}
		return probs;
	},
	min_p: (tokens, probs) => {
		if(tokens.length === 0) return;
		let p = $("input#min_p").closest('div.alert').find('input[type="range"]').val();
		let cutoff = probs[tokens[0]] * p;
		for(let tok of tokens) {
			if(probs[tok] < cutoff) {
				delete probs[tok];
			}
		}
		return probs;
	},
	top_a: (tokens, probs) => {
		if(tokens.length === 0) return;
		let p = $("input#top_a").closest('div.alert').find('input[type="range"]').val();
		let cutoff = probs[tokens[0]] * p * p;
		for(let tok of tokens) {
			if(probs[tok] < cutoff) {
				delete probs[tok];
			}
		}
		return probs;
	},
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
	$("div#samplers div.alert:has(input:checked)").each((idx, el) => {
		let sname = $(el).find('input:checked').prop('id');
		probs = samplers[sname](Object.keys(probs), probs);
	});
	let tokens = Object.keys(probs);
	for(let t of tokens) {
		sum += probs[t];
	}
	let pcf = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 3, minimumFractionDigits: 3 });
	for(let t of tokens) {
		let tr = document.createElement('tr');
		let td = document.createElement('td');
		tbody.appendChild(tr);
		tr.appendChild(td);
		td.textContent = t;
		td = document.createElement('td');
		tr.appendChild(td);
		td.textContent = pcf.format(probs[t] / sum);
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
		pbar.setAttribute('style', 'width: ' + (100.0 * probs[t] / sum).toFixed(2) + '%;')
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
			$(e.target).closest('div.alert').find('input[type="' + types[1-i] + '"]').val(v);
		});
	}

	$("select#prompts").on('change', update_prompt);
	$("select#prompts").on('input', update_prompt);
	$("div#samplers input").on('input', update_sample);
	$("div#samplers").sortable({ update: update_sample });
});

#!/usr/bin/env node
/**
 * Build memorabilia carousel HTML from carousel-groups.json + manifest alt text.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('images/gaming-memorabilia');
const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'carousel-groups.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

const altByFile = {};
for (const set of Object.values(manifest.sets)) {
	for (const img of set.images) {
		altByFile[`${img.key}/${img.file}`] = img.alt.replace(/ — photo /g, ', photo ');
	}
}

function renderCarousel(group, folder) {
	const slides = group.files.map((file, i) => {
		const rel = `${folder}/${file}`;
		const alt =
			altByFile[rel] ||
			`${group.title.replace(/ \(.*\)$/, '')}, photo ${i + 1}`;
		return { file, alt, rel };
	});

	const thumbButtons = slides
		.map(
			(slide, i) => `							<button
								type="button"
								class="memorabilia-box-carousel__thumb${i === 0 ? ' memorabilia-box-carousel__thumb--active' : ''}"
								role="tab"
								aria-selected="${i === 0 ? 'true' : 'false'}"
								aria-label="Photo ${i + 1}"
							>
								<img
									src="../images/gaming-memorabilia/${slide.rel}"
									data-full="../images/gaming-memorabilia/${slide.rel}"
									alt="${slide.alt}"
									loading="lazy"
									decoding="async"
								/>
							</button>`,
		)
		.join('\n');

	const first = slides[0];
	return `					<div class="memorabilia-box-carousel" data-memorabilia-carousel id="${group.id}">
						<h4 class="memorabilia-box-carousel__title">${group.title}</h4>
						<div class="memorabilia-box-carousel__main">
							<button
								type="button"
								class="memorabilia-box-carousel__nav memorabilia-box-carousel__nav--prev"
								aria-label="Previous photo"
							>
								‹
							</button>
							<div class="memorabilia-box-carousel__stage" tabindex="0">
								<img
									class="memorabilia-box-carousel__hero memorabilia-box-carousel__hero--visible"
									src="../images/gaming-memorabilia/${first.rel}"
									alt="${first.alt}"
									loading="eager"
									decoding="async"
								/>
								<span class="memorabilia-box-carousel__counter" aria-live="polite">1 / ${slides.length}</span>
							</div>
							<button
								type="button"
								class="memorabilia-box-carousel__nav memorabilia-box-carousel__nav--next"
								aria-label="Next photo"
							>
								›
							</button>
						</div>
						<div class="memorabilia-box-carousel__thumbs" role="tablist" aria-label="${group.title} photos">
${thumbButtons}
						</div>
					</div>`;
}

function renderSection(sectionKey, folder) {
	const carousels = groups[sectionKey];
	return carousels.map((g) => renderCarousel(g, folder)).join('\n\n');
}

const fragments = {
	ac: renderSection('ac', 'ac'),
	bf: renderSection('bf', 'bf'),
	skyrim: renderSection('skyrim', 'skyrim'),
	'black-ops': renderSection('black-ops', 'black-ops'),
};

fs.writeFileSync(path.join(ROOT, 'carousel-fragments.json'), JSON.stringify(fragments, null, 2));

const galleryFragments = {};
for (const key of Object.keys(fragments)) {
	galleryFragments[key] = `\t\t\t\t\t<div class="memorabilia-carousel-grid" id="gallery-${key}">\n${fragments[key]}\n\t\t\t\t\t</div>`;
}
fs.writeFileSync(path.join(ROOT, 'gallery-fragments.json'), JSON.stringify(galleryFragments, null, 2));

console.log('Wrote carousel-fragments.json + gallery-fragments.json');
for (const key of Object.keys(fragments)) {
	console.log(`  ${key}: ${groups[key].length} carousel(s)`);
}

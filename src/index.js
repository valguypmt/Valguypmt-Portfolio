import { initHeroThree } from './three/heroScene';
import en from './locale/en.json';
import vi from './locale/vi.json';

const localeMessages = { en, vi };
const savedLanguage = localStorage.getItem('site-language');
let currentLanguage = savedLanguage === 'vi' ? 'vi' : 'en';

const getMessage = (language, key) => {
    const value = key.split('.').reduce((current, part) => current && current[part], localeMessages[language]);
    if (typeof value !== 'string') {
        throw new Error(`Missing ${language} translation: ${key}`);
    }
    return value;
};

const translate = key => getMessage(currentLanguage, key);

const bgOverlay = document.getElementById('bgOverlay');
const navbar = document.getElementById('navbar');
const headerVideo = document.getElementById('headerVideo');
const brandLogoImage = document.getElementById('brandLogoImage');
const faviconLink = document.getElementById('siteFavicon');
const fixedBg = document.getElementById('fixedBg');
const videoControl = document.querySelector('.video-control');
const musicControl = document.querySelector('.music-control');
const musicControlWrap = document.querySelector('.music-control-wrap');
const musicVolume = document.querySelector('#musicVolume');
const musicVolumeValue = document.querySelector('.music-volume-value');
const backToTopButton = document.querySelector('.back-to-top');
const aboutSection = document.getElementById('about-me');
const backgroundMusic = document.getElementById('backgroundMusic');
const backgroundMusicSource = backgroundMusic.querySelector('source');
const headerVideoSource = headerVideo.querySelector('source');
const musicFadeDuration = 700;
let musicTargetVolume = 1;
let musicEnabled = false;
let musicUnavailable = false;
let musicRequestId = 0;
let musicFadeFrame = 0;
let musicVolumePressTimer = 0;
let musicVolumeDismissTimer = 0;
let suppressMusicClick = false;

backgroundMusic.volume = 0;
backgroundMusic.muted = true;

const updateMusicControl = () => {
    musicControl.dataset.selected = musicEnabled ? 'playing' : musicUnavailable ? 'unavailable' : 'muted';
    musicControl.setAttribute('aria-pressed', String(musicEnabled));
    const label = translate(musicUnavailable
        ? 'header.music.unavailable'
        : musicEnabled
            ? 'header.music.mute'
            : 'header.music.play');
    musicControl.setAttribute('aria-label', label);
    musicControl.title = label;
};

const reportMusicFailure = error => {
    if (!musicEnabled) {
        return;
    }

    musicEnabled = false;
    musicUnavailable = true;
    musicRequestId += 1;
    if (musicFadeFrame) {
        cancelAnimationFrame(musicFadeFrame);
        musicFadeFrame = 0;
    }
    backgroundMusic.pause();
    backgroundMusic.muted = true;
    backgroundMusic.volume = 0;
    updateMusicControl();
    console.error('Could not play background music:', error);
};

// Ease volume changes to avoid abrupt starts and stops.
const fadeMusicTo = (targetVolume, onComplete) => {
    if (musicFadeFrame) {
        cancelAnimationFrame(musicFadeFrame);
    }

    const startingVolume = backgroundMusic.volume;
    const startedAt = performance.now();
    const updateVolume = timestamp => {
        const progress = Math.min((timestamp - startedAt) / musicFadeDuration, 1);
        const easedProgress = progress * progress * (3 - 2 * progress);
        backgroundMusic.volume = startingVolume + (targetVolume - startingVolume) * easedProgress;

        if (progress < 1) {
            musicFadeFrame = requestAnimationFrame(updateVolume);
            return;
        }

        musicFadeFrame = 0;
        backgroundMusic.volume = targetVolume;
        if (onComplete) {
            onComplete();
        }
    };

    musicFadeFrame = requestAnimationFrame(updateVolume);
};

const startBackgroundMusic = () => {
    if (!backgroundMusic.canPlayType(backgroundMusicSource.type)) {
        musicUnavailable = true;
        updateMusicControl();
        console.error(`Background music format is not supported: ${backgroundMusicSource.type}`);
        return;
    }

    const requestId = ++musicRequestId;
    musicUnavailable = false;
    musicEnabled = true;
    backgroundMusic.muted = false;
    updateMusicControl();

    if (!backgroundMusic.paused) {
        fadeMusicTo(musicTargetVolume);
        return;
    }

    backgroundMusic.volume = 0;
    backgroundMusic.play().then(() => {
        if (requestId === musicRequestId && musicEnabled) {
            fadeMusicTo(musicTargetVolume);
        }
    }).catch(error => {
        if (requestId !== musicRequestId) {
            return;
        }

        reportMusicFailure(error);
    });
};

const stopBackgroundMusic = () => {
    const requestId = ++musicRequestId;
    musicEnabled = false;
    updateMusicControl();
    fadeMusicTo(0, () => {
        if (requestId === musicRequestId && !musicEnabled) {
            backgroundMusic.pause();
            backgroundMusic.muted = true;
        }
    });
};

backgroundMusic.addEventListener('error', () => {
    reportMusicFailure(backgroundMusic.error || new Error('The audio file could not be loaded.'));
});

musicVolume.addEventListener('input', () => {
    musicTargetVolume = Number(musicVolume.value) / 100;
    musicVolumeValue.value = `${musicVolume.value}%`;

    if (musicEnabled && !backgroundMusic.paused) {
        if (musicFadeFrame) {
            cancelAnimationFrame(musicFadeFrame);
            musicFadeFrame = 0;
        }
        backgroundMusic.volume = musicTargetVolume;
    }
});

const openMusicVolume = () => {
    musicControlWrap.classList.add('is-volume-open');
    window.clearTimeout(musicVolumeDismissTimer);
    musicVolumeDismissTimer = window.setTimeout(() => {
        musicControlWrap.classList.remove('is-volume-open');
    }, 5000);
};

musicControl.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') {
        return;
    }

    musicVolumePressTimer = window.setTimeout(() => {
        openMusicVolume();
        suppressMusicClick = true;
        window.setTimeout(() => {
            suppressMusicClick = false;
        }, 1000);
    }, 500);
});

const cancelMusicVolumePress = () => {
    window.clearTimeout(musicVolumePressTimer);
};

musicControl.addEventListener('pointerup', cancelMusicVolumePress);
musicControl.addEventListener('pointercancel', cancelMusicVolumePress);
musicControl.addEventListener('pointerleave', cancelMusicVolumePress);

musicControlWrap.addEventListener('keydown', event => {
    if (event.key === 'Escape' && musicControlWrap.classList.contains('is-volume-open')) {
        musicControlWrap.classList.remove('is-volume-open');
        musicControl.focus();
    }
});

document.addEventListener('pointerdown', event => {
    if (!musicControlWrap.contains(event.target)) {
        musicControlWrap.classList.remove('is-volume-open');
    }
});

// Highlight the section currently under the header.
const navigationLinks = Array.from(navbar.querySelectorAll('.site-nav a'));
const getPageTop = section => section.getBoundingClientRect().top + window.scrollY;
const updateBackToTopVisibility = () => {
    backToTopButton.hidden = window.scrollY <= getPageTop(aboutSection) + aboutSection.offsetHeight;
};
const navigationSections = navigationLinks
    .map(link => ({ link, section: document.getElementById(link.hash.slice(1)) }))
    .filter(item => item.section)
    .sort((first, second) => getPageTop(first.section) - getPageTop(second.section));

const updateActiveNavigation = () => {
    const scrollPosition = window.scrollY + navbar.offsetHeight + 32;
    let activeItem = navigationSections[0];

    navigationSections.forEach(item => {
        if (getPageTop(item.section) <= scrollPosition) {
            activeItem = item;
        }
    });

    navigationSections.forEach(item => {
        if (item === activeItem) {
            item.link.setAttribute('aria-current', 'location');
        } else {
            item.link.removeAttribute('aria-current');
        }
    });
};

brandLogoImage.addEventListener('error', () => {
    brandLogoImage.hidden = true;
});

const playHeaderVideo = () => {
    if (headerVideo.autoplay && headerVideo.paused) {
        headerVideo.play().catch(() => {});
    }
};

if (headerVideo) {
    headerVideo.muted = true;
    headerVideo.loop = true;
    headerVideo.playsInline = true;

    headerVideo.addEventListener('canplay', playHeaderVideo);
    headerVideo.addEventListener('ended', playHeaderVideo);
    window.addEventListener('pageshow', playHeaderVideo);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            playHeaderVideo();
        }
    });

    playHeaderVideo();
}

videoControl.addEventListener('click', () => {
    const videoEnabled = videoControl.dataset.selected !== 'video';
    applyWallpaperMode(videoEnabled ? 'video' : 'image');
});

musicControl.addEventListener('click', () => {
    if (suppressMusicClick) {
        suppressMusicClick = false;
        return;
    }

    if (musicEnabled) {
        stopBackgroundMusic();
    } else {
        startBackgroundMusic();
    }
});

window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const heroHeight = window.innerHeight;

    const fadeProgress = Math.min(scrollY / (heroHeight * 0.8), 1);
    bgOverlay.style.opacity = 0.4 + (fadeProgress * 0.6);

    if (scrollY > 50) {
        navbar.classList.add('is-scrolled');
        navbar.classList.remove('at-top');
    } else {
        navbar.classList.add('at-top');
        navbar.classList.remove('is-scrolled');
    }

    updateActiveNavigation();
    updateBackToTopVisibility();
});

updateActiveNavigation();
updateBackToTopVisibility();

backToTopButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Reveal content on entry while respecting reduced-motion preferences.
const revealTargets = Array.from(document.querySelectorAll('.about-me-panel, .journey-panel, .projects-panel, .contact-panel, .project-card, .section-box'));

if (revealTargets.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    revealTargets.forEach(target => target.classList.add('scroll-reveal'));
    document.documentElement.classList.add('has-scroll-reveal');

    const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    revealTargets.forEach(target => revealObserver.observe(target));
}

const contactForm = document.querySelector('.contact-form');

contactForm.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(contactForm);
    const name = String(formData.get('name')).trim();
    const email = String(formData.get('email')).trim();
    const subject = String(formData.get('subject')).trim();
    const message = String(formData.get('message')).trim();
    const body = translate('contact.form.emailTemplate')
        .replace('{name}', name)
        .replace('{email}', email)
        .replace('{message}', message);

    window.location.href = `mailto:${contactForm.dataset.recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

const projectDialog = document.querySelector('#project-dialog');
const projectDialogImage = projectDialog.querySelector('.project-dialog-image');
const projectDialogTitle = projectDialog.querySelector('#project-dialog-title');
const projectDialogCategory = projectDialog.querySelector('.project-dialog-category');
const projectDialogDescription = projectDialog.querySelector('#project-dialog-description');
const projectDialogTechnologies = projectDialog.querySelector('.project-dialog-tech');
const projectDialogRepository = projectDialog.querySelector('.project-dialog-repository');
const projectDialogDeployment = projectDialog.querySelector('.project-dialog-deployment');
const markImageLoaded = image => {
    if (image.complete && image.naturalWidth > 0) {
        image.classList.add('is-loaded');
    }
};

document.querySelectorAll('.project-card-image').forEach(image => {
    image.addEventListener('load', () => image.classList.add('is-loaded'));
    markImageLoaded(image);
});

// Fill one shared dialog with the details from the selected project card.
projectDialogImage.addEventListener('load', () => projectDialogImage.classList.add('is-loaded'));
document.querySelectorAll('.project-card-open').forEach(openButton => {
    openButton.addEventListener('click', () => {
        projectDialogImage.classList.remove('is-loaded');
        projectDialogImage.src = openButton.dataset.projectImage;
        projectDialogTitle.textContent = openButton.dataset.projectTitle;
        projectDialogCategory.textContent = openButton.dataset.projectCategory;
        projectDialogDescription.textContent = openButton.dataset.projectDescription;
        const technologies = Array.from(openButton.querySelectorAll('.project-card-tech [role="listitem"]'), technology => {
            const item = document.createElement('li');
            item.textContent = technology.textContent.trim();
            return item;
        });
        projectDialogTechnologies.replaceChildren(...technologies);
        projectDialogRepository.href = openButton.dataset.projectRepository;
        const deploymentUrl = openButton.dataset.projectDeployment;
        if (deploymentUrl) {
            projectDialogDeployment.href = new URL(deploymentUrl, window.location.href).href;
            projectDialogDeployment.hidden = false;
        } else {
            projectDialogDeployment.hidden = true;
            projectDialogDeployment.removeAttribute('href');
        }
        markImageLoaded(projectDialogImage);
        projectDialog.showModal();
        projectDialog.append(customCursor);
    });
});

projectDialog.querySelector('.project-dialog-close').addEventListener('click', () => {
    projectDialog.close();
});

projectDialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        event.preventDefault();
        projectDialog.close();
    }
});

projectDialog.addEventListener('click', event => {
    if (event.target === projectDialog) {
        projectDialog.close();
    }
});

const journeySection = document.querySelector('.journey-section');
const journeyReplayButton = journeySection.querySelector('.journey-caption');
const journeyTrack = journeySection.querySelector('.journey-track');
const journeyMilestones = Array.from(journeyTrack.querySelectorAll('.journey-milestone'));
const journeyDuration = 2100;
const journeyCount = journeyMilestones.length;

journeySection.style.setProperty('--journey-duration', `${journeyDuration}ms`);
journeySection.style.setProperty('--journey-last-point', `${((journeyCount - 1) / journeyCount) * 100}%`);
journeyMilestones.forEach((milestone, index) => {
    const progress = journeyCount > 1 ? index / (journeyCount - 1) : 0;
    const delay = 120 + (0.08 + 0.8 * progress) * journeyDuration;
    milestone.style.setProperty('--journey-delay', `${delay}ms`);
});

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    journeySection.classList.add('journey-animation-ready');

    if ('IntersectionObserver' in window) {
        const journeyObserver = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) {
                journeySection.classList.add('is-visible');
                journeyObserver.disconnect();
            }
        }, { threshold: 0.2 });

        journeyObserver.observe(journeySection);
    } else {
        journeySection.classList.add('is-visible');
    }
}

journeyReplayButton.addEventListener('click', () => {
    if (!journeySection.classList.contains('journey-animation-ready')) {
        return;
    }

    journeySection.classList.remove('is-visible');
    void journeySection.offsetWidth;
    journeySection.classList.add('is-visible');
});

const languageControl = document.querySelector('.language-control');
const languageCurrent = languageControl.querySelector('.language-current');
const themeControl = document.querySelector('.theme-control');

// Update visible copy and project details for the selected language.
const applyLocale = language => {
    currentLanguage = language;
    document.documentElement.lang = language;

    document.querySelectorAll('[data-i18n]').forEach(element => {
        element.textContent = getMessage(language, element.dataset.i18n);
    });

    [
        ['data-i18n-aria-label', 'aria-label'],
        ['data-i18n-alt', 'alt'],
        ['data-i18n-placeholder', 'placeholder'],
        ['data-i18n-content', 'content']
    ].forEach(([translationAttribute, targetAttribute]) => {
        document.querySelectorAll(`[${translationAttribute}]`).forEach(element => {
            element.setAttribute(targetAttribute, getMessage(language, element.getAttribute(translationAttribute)));
        });
    });

    document.querySelectorAll('.project-card-open').forEach(button => {
        const projectStrings = localeMessages.en.projects;
        const project = projectStrings.items[button.dataset.projectKey];
        if (!project) {
            throw new Error(`Missing English project content: ${button.dataset.projectKey}`);
        }

        button.dataset.projectTitle = project.dialogTitle;
        button.dataset.projectCategory = projectStrings.category;
        button.dataset.projectDescription = project.description;
        button.setAttribute('aria-label', projectStrings.viewDetailsTemplate.replace('{title}', project.dialogTitle));

        const technologyList = button.querySelector('.project-card-tech');
        technologyList.setAttribute('aria-label', projectStrings.technologiesLabel);
        technologyList.replaceChildren(...project.technologies.map(technology => {
            const item = document.createElement('span');
            item.setAttribute('role', 'listitem');
            item.textContent = technology;
            return item;
        }));
    });

    languageControl.dataset.selected = language.toUpperCase();
    languageCurrent.textContent = language.toUpperCase();
    languageControl.setAttribute('aria-label', getMessage(language, language === 'en'
        ? 'header.language.toVietnamese'
        : 'header.language.toEnglish'));
    themeControl.setAttribute('aria-label', getMessage(language, themeControl.dataset.selected === 'light'
        ? 'header.theme.toDark'
        : 'header.theme.toLight'));
    videoControl.setAttribute('aria-label', getMessage(language, videoControl.dataset.selected === 'video'
        ? 'header.wallpaper.pause'
        : 'header.wallpaper.play'));
    updateMusicControl();
};

applyLocale(currentLanguage);

languageControl.addEventListener('click', () => {
    const nextLanguage = currentLanguage === 'en' ? 'vi' : 'en';
    applyLocale(nextLanguage);
    localStorage.setItem('site-language', nextLanguage);
});

// Keep the wallpaper video and poster paired with the active theme.
const getVideoPoster = (theme) => theme === 'dark'
    ? '/images/header-dark.webp'
    : '/images/header-light.webp';

const applyWallpaperMode = (mode) => {
    const videoEnabled = mode === 'video';
    headerVideo.autoplay = videoEnabled;
    videoControl.dataset.selected = mode;
    videoControl.setAttribute('aria-pressed', String(videoEnabled));
    videoControl.setAttribute('aria-label', translate(videoEnabled ? 'header.wallpaper.pause' : 'header.wallpaper.play'));
    fixedBg.classList.toggle('wallpaper-static', !videoEnabled);

    if (videoEnabled) {
        headerVideo.load();
        playHeaderVideo();
    } else {
        headerVideo.pause();
    }
};

const applyHeaderVideoTheme = (theme) => {
    brandLogoImage.hidden = false;
    brandLogoImage.src = `/images/logo-${theme}.webp`;
    faviconLink.href = brandLogoImage.src;

    if (headerVideo.dataset.theme === theme) {
        return;
    }

    headerVideo.dataset.theme = theme;
    headerVideo.poster = getVideoPoster(theme);
    headerVideoSource.type = theme === 'dark' ? 'video/webm' : 'video/mp4';
    headerVideoSource.src = theme === 'dark'
        ? '/videos/header-dark.webm'
        : '/videos/header-light.mp4';
    headerVideo.load();
};

const applyTheme = (theme) => {
    const isLight = theme === 'light';
    themeControl.dataset.selected = theme;
    themeControl.setAttribute('aria-pressed', String(isLight));
    themeControl.setAttribute('aria-label', translate(isLight ? 'header.theme.toDark' : 'header.theme.toLight'));
    document.body.classList.toggle('light-theme', isLight);
    document.documentElement.dataset.theme = theme;
    applyHeaderVideoTheme(theme);
};

const savedTheme = localStorage.getItem('site-theme');
applyTheme(savedTheme === 'light' ? 'light' : 'dark');
applyWallpaperMode(videoControl.dataset.selected === 'image' ? 'image' : 'video');

themeControl.addEventListener('click', () => {
    const nextTheme = themeControl.dataset.selected === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    localStorage.setItem('site-theme', nextTheme);
});

const heroVisual = document.querySelector('.hero-visual');
const heroObject = heroVisual.querySelector('.hero-object');

// Fall back to the CSS model when WebGL is unavailable.
let heroScene = null;
try {
    heroScene = initHeroThree(heroVisual);
} catch (error) {
    console.error('Could not initialize the hero Three.js scene:', error);
}

if (heroScene) {
    heroVisual.classList.add('scene-ready');
} else {
    console.warn('WebGL is unavailable; showing the CSS hero fallback.');

    heroVisual.addEventListener('pointermove', event => {
        const bounds = heroVisual.getBoundingClientRect();
        const horizontalPosition = (event.clientX - bounds.left) / bounds.width - 0.5;
        const verticalPosition = (event.clientY - bounds.top) / bounds.height - 0.5;

        heroObject.style.transform = `rotateX(${verticalPosition * -18}deg) rotateY(${horizontalPosition * 18}deg)`;
    });

    heroVisual.addEventListener('pointerleave', () => {
        heroObject.style.transform = 'rotateX(0deg) rotateY(0deg)';
    });
}

const customCursor = document.querySelector('.custom-cursor');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

projectDialog.addEventListener('close', () => {
    document.body.append(customCursor);
});

if (finePointer.matches) {
    document.body.classList.add('has-custom-cursor');

    document.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') {
            return;
        }

        const target = event.target instanceof Element ? event.target : null;
        const isEditing = target?.closest('input:not([type="range"]), textarea, select, [contenteditable="true"]');
        const isInteractive = target?.closest('a, button, [role="button"], summary, input[type="range"]');
        const isContactTextField = Boolean(target?.closest('.contact-field input, .contact-field textarea'));

        customCursor.style.setProperty('--cursor-x', `${event.clientX}px`);
        customCursor.style.setProperty('--cursor-y', `${event.clientY}px`);
        customCursor.style.setProperty('--ring-x', `${event.clientX}px`);
        customCursor.style.setProperty('--ring-y', `${event.clientY}px`);

        customCursor.classList.toggle('is-visible', !isEditing || isContactTextField);
        customCursor.classList.toggle('is-interactive', (Boolean(isInteractive) || Boolean(target?.closest('.contact-field'))) && !isEditing);
        customCursor.classList.toggle('is-text-field', isContactTextField);
    });

    document.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
            customCursor.classList.add('is-clicking');
        }
    });

    document.addEventListener('pointerup', () => {
        customCursor.classList.remove('is-clicking');
    });

    document.addEventListener('pointerout', event => {
        if (!event.relatedTarget) {
            customCursor.classList.remove('is-visible', 'is-interactive', 'is-clicking');
        }
    });
}
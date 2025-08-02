(function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j = 0; j < document.scripts.length; j++) {
        if (document.scripts[j].src === r) return;
    }
    k=e.createElement(t),a=e.getElementsByTagName(t)[0];
    k.async=1;k.src=r;a.parentNode.insertBefore(k,a);
})(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

ym(44147844, 'init', {
    webvisor: true,
    clickmap: true,
    accurateTrackBounce: true,
    trackLinks: true
});

window.yaContextCb = window.yaContextCb || [];

window.yaContextCb.push(() => {
    Ya.Context.AdvManager.render({
        blockId: "R-A-15699059-6",
        type: "fullscreen",
        platform: "touch"
    });
});

window.yaContextCb.push(() => {
    Ya.Context.AdvManager.render({
        blockId: "R-A-15699059-8",
        renderTo: "yandex_rtb_R-A-15699059-8"
    });
});

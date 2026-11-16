{{--
    Menimpa views/components/global-search/index.blade.php bawaan Filament.

    Bawaan Filament: Livewire tidak mengembalikan hasil saat kolom kosong, jadi dropdown baru muncul setelah
    pengguna mengetik. Di sini dropdown SELALU dirender peladen (berisi saran dari PencarianPanel::saran()
    saat kolom kosong atau baru satu huruf), tersembunyi sampai kolom difokuskan. Akibatnya Ctrl/Cmd+K atau
    klik di kolom langsung membuka dropdown tanpa perjalanan ke peladen.

    Yang sengaja dijaga:
    - Tidak terbuka sendiri saat halaman dimuat (x-init hanya membuka kalau sedang mencari, dan x-cloak
      mencegah kedipan sebelum Alpine menyala).
    - Klik di dalam kolom tidak menutup dropdown (click.away mengabaikan klik di kolom).
    - Ctrl/Cmd+K membuka kembali dropdown yang sempat ditutup Esc walau kolom masih terfokus.
    - Pembukaan lewat fokus/klik/Ctrl+K memakai event k3-buka-cari yang SINKRON. Event bawaan Filament
      (open-global-search-results) menunda lewat $nextTick; bila dipakai di sini, Esc yang ditekan sangat cepat
      bisa jatuh sebelum penundaan itu dan dropdown terbuka kembali. Event bawaan tetap dipakai untuk hasil ketikan.
    - Sisanya (pintasan Mousetrap, panah naik-turun, Esc) tetap perilaku bawaan Filament.
--}}
@php
    $penyedia = \Filament\Facades\Filament::getGlobalSearchProvider();
    $kata = trim((string) $this->search);
    $mencari = mb_strlen($kata) >= \App\Filament\Pencarian\PencarianPanel::MIN_HURUF;
    $results ??= method_exists($penyedia, 'saran') ? $penyedia->saran() : null;
@endphp

<div
    x-data="{}"
    x-on:focus-first-global-search-result.stop="$el.querySelector('.fi-global-search-result-link')?.focus()"
    class="fi-global-search flex items-center"
>
    {{ \Filament\Support\Facades\FilamentView::renderHook(\Filament\View\PanelsRenderHook::GLOBAL_SEARCH_START) }}

    <div
        class="sm:relative"
        x-on:focusin="$dispatch('k3-buka-cari')"
        x-on:click="$dispatch('k3-buka-cari')"
        x-on:keydown.window.ctrl.k="$dispatch('k3-buka-cari')"
        x-on:keydown.window.meta.k="$dispatch('k3-buka-cari')"
    >
        <x-filament-panels::global-search.field />

        @if ($results !== null)
            <div
                x-data="{
                    isOpen: false,

                    open: function () {
                        this.isOpen = true
                    },

                    close: function () {
                        this.isOpen = false
                    },
                }"
                @if ($mencari) x-init="$nextTick(() => open())" @endif
                x-on:click.away="if (! $event.target.closest('.fi-global-search-field')) close()"
                x-on:keydown.escape.window="close()"
                x-on:keydown.up.prevent="$focus.wrap().previous()"
                x-on:keydown.down.prevent="$focus.wrap().next()"
                x-on:k3-buka-cari.window="open()"
                x-on:open-global-search-results.window="$nextTick(() => open())"
                x-cloak
                x-show="isOpen"
                x-transition:enter-start="opacity-0"
                x-transition:leave-end="opacity-0"
                class="fi-global-search-results-ctn absolute inset-x-4 z-10 mt-2 max-h-96 overflow-auto rounded-lg bg-white shadow-lg ring-1 ring-gray-950/5 transition dark:bg-gray-900 dark:ring-white/10 sm:inset-x-auto sm:end-0 sm:w-screen sm:max-w-sm [transform:translateZ(0)]"
            >
                @unless ($mencari)
                    <p class="k3-cari-petunjuk">Ketik untuk mencari aset, temuan, inspeksi, atau halaman.</p>
                @endunless

                @if ($results->getCategories()->isEmpty())
                    <x-filament-panels::global-search.no-results-message />
                @else
                    <ul class="divide-y divide-gray-200 dark:divide-white/10">
                        @foreach ($results->getCategories() as $group => $groupedResults)
                            <x-filament-panels::global-search.result-group
                                :label="$group"
                                :results="$groupedResults"
                            />
                        @endforeach
                    </ul>
                @endif
            </div>
        @endif
    </div>

    {{ \Filament\Support\Facades\FilamentView::renderHook(\Filament\View\PanelsRenderHook::GLOBAL_SEARCH_END) }}
</div>

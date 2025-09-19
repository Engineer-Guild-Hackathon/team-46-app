<script lang="ts">
  // Simple copyrights page component
</script>

<main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="mb-6">
    <button
      onclick={() => window.history.back()}
      class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
    >
      ← 戻る
    </button>
    <h1 class="text-2xl font-bold text-gray-900 mb-2">著作権情報</h1>
    <p class="text-gray-600">法的通知および帰属情報</p>
  </div>

  <div class="bg-white rounded-lg shadow-sm border p-6 space-y-6">
    <!-- Translation Copyright -->
    <section>
      <h2 class="text-lg font-semibold text-gray-900 mb-3">翻訳権</h2>
      <div class="text-sm text-gray-700 space-y-2">
        <div class="font-medium">(C) 1999 山形浩生</div>
        <p class="leading-relaxed">
          本翻訳は、この版権表示を残す限りにおいて、訳者および著者にたいして許可をとったり使用料を支払ったりすることいっさいなしに、商業利用を含むあらゆる形で自由に利用・複製が認められる。（「この版権表示を残す」んだから、「禁無断複製」とかいうのはダメだぞ）
        </p>
        <p>
          プロジェクト杉田玄白 正式参加作品。詳細は
          <a
            href="http://www.genpaku.org/"
            class="text-blue-600 underline hover:text-blue-800"
            target="_blank"
            rel="noopener noreferrer"
          >
            http://www.genpaku.org/
          </a>
          を参照のこと。
        </p>
      </div>
    </section>

    <!-- App Copyright -->
    <section>
      <h2 class="text-lg font-semibold text-gray-900 mb-3">アプリケーション</h2>
      <div class="text-sm text-gray-700">
        <p>© 2025 FlexRead. Engineer Guild Hackathon向けに開発。</p>
        <p class="mt-2 text-gray-500">
          このアプリケーションは、パブリックドメインおよび自由に利用可能なテキストの読書インターフェースを提供します。すべてのコンテンツの権利は、それぞれの所有者に帰属します。
        </p>
      </div>
    </section>

    <!-- Additional Legal -->
    <section>
      <h2 class="text-lg font-semibold text-gray-900 mb-3">免責事項</h2>
      <div class="text-sm text-gray-600">
        <p>
          このアプリケーションは「現状のまま」提供され、いかなる種類の保証もありません。開発者は、このアプリケーションを通じてアクセスされる外部テキストや翻訳の内容について責任を負いません。
        </p>
      </div>
    </section>
  </div>
</main>

<script lang="ts">
  // Simple copyrights page component
</script>

<main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="mb-6">
    <button
      onclick={() => window.history.back()}
      class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
    >
      ← Back
    </button>
    <h1 class="text-2xl font-bold text-gray-900 mb-2">Copyright Information</h1>
    <p class="text-gray-600">Legal notices and attribution information</p>
  </div>

  <div class="bg-white rounded-lg shadow-sm border p-6 space-y-6">
    <!-- Translation Copyright -->
    <section>
      <h2 class="text-lg font-semibold text-gray-900 mb-3">
        Translation Rights
      </h2>
      <div class="text-sm text-gray-700 space-y-2">
        <div class="font-medium">(C) 1999 山形浩生</div>
        <p class="leading-relaxed">
          本翻訳は、この版権表示を残す限りにおいて、訳者および著者にたいして許可をとったり使用料を支払ったりすることいっさいなしに、商業利用を含むあらゆる形で自由に利用・複製が認められる。（「この版権表示を残す」んだから、「禁無断複製」とかいうのはダメだぞ）
        </p>
        <p>
          プロジェクト杉田玄白　正式参加作品。詳細は
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
      <h2 class="text-lg font-semibold text-gray-900 mb-3">Application</h2>
      <div class="text-sm text-gray-700">
        <p>© 2025 FlexRead. Built for Engineer Guild Hackathon.</p>
        <p class="mt-2 text-gray-500">
          This application provides a reading interface for public domain and
          freely available texts. All content rights belong to their respective
          owners.
        </p>
      </div>
    </section>

    <!-- Additional Legal -->
    <section>
      <h2 class="text-lg font-semibold text-gray-900 mb-3">Disclaimer</h2>
      <div class="text-sm text-gray-600">
        <p>
          This application is provided "as is" without warranty of any kind. The
          developers are not responsible for the content of external texts or
          translations accessed through this application.
        </p>
      </div>
    </section>
  </div>
</main>

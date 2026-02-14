import { useState } from 'react';
import { Link } from 'react-router-dom';

const sections = [
  {
    id: 'principe',
    title: 'Principe du jeu',
    color: 'text-white',
    borderColor: 'border-gray-600',
    content: (
      <>
        <p className="mb-3">
          <strong>Les Immortels</strong> est un jeu de Loup-Garou grandeur nature.
        </p>
        <p className="mb-3">
          Au début de la partie, chaque joueur reçoit secrètement un rôle :
          <strong className="text-red-400"> Loup</strong> ou
          <strong className="text-blue-400"> Villageois</strong>.
          Le rôle est affiché une seule fois sur votre téléphone — retenez-le bien !
        </p>
        <p>
          Le jeu alterne entre des <strong>phases de nuit</strong> et des
          <strong> conseils du village</strong>. Les loups tentent d'éliminer
          les villageois, et les villageois tentent d'identifier et d'éliminer les loups.
        </p>
      </>
    ),
  },
  {
    id: 'roles',
    title: 'Rôles de base',
    color: 'text-white',
    borderColor: 'border-gray-600',
    content: (
      <div className="space-y-4">
        <div className="bg-red-900/20 border border-red-900/40 rounded-lg p-4">
          <h4 className="text-red-400 font-semibold mb-2">Loup</h4>
          <ul className="text-gray-300 space-y-1 text-sm">
            <li>- Vote chaque nuit pour éliminer un villageois</li>
            <li>- Peut communiquer discrètement avec les autres loups en journée</li>
            <li>- Connaît l'identité des autres loups lors de la révélation du rôle. Retenez bien qui sont vos alliés ou allez discretement redemander au maitre du jeu.</li>
          </ul>
        </div>
        <div className="bg-blue-900/20 border border-blue-900/40 rounded-lg p-4">
          <h4 className="text-blue-400 font-semibold mb-2">Villageois</h4>
          <ul className="text-gray-300 space-y-1 text-sm">
            <li>- Vote au conseil du village pour éliminer un suspect</li>
            <li>- Chaque nuit, choisit un joueur qu'il pense être villageois (+1 point si correct)</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'nuit',
    title: 'Phase de nuit',
    color: 'text-purple-400',
    borderColor: 'border-purple-900/40',
    content: (
      <>
        <p className="mb-3">
          Chaque nuit, <strong>tous les joueurs</strong> votent sur leur téléphone
          en même temps :
        </p>
        <ul className="space-y-2 text-gray-300 text-sm mb-3">
          <li>
            <strong className="text-red-400">Les loups</strong> choisissent un joueur vivant
            (hors loups) à éliminer. La majorité l'emporte. Si égalité, tirage au sort parmi les ex-æquo. Les loups peuvent se concerter discrètement avant de voter.
          </li>
          <li>
            <strong className="text-blue-400">Les villageois</strong> choisissent un joueur
            qu'ils pensent être villageois (devinette). +1 point si correct.
          </li>
          <li>
            <strong className="text-green-400">Les fantômes</strong> votent aussi pour éliminer
            un joueur vivant (voir section Fantômes).
          </li>
        </ul>
        <p className="text-gray-400 text-sm">
          Le vote est définitif — pas de retour en arrière après confirmation.
          L'admin peut forcer la clôture des votes si un joueur ne répond pas.
        </p>
      </>
    ),
  },
  {
    id: 'conseil',
    title: 'Conseil du village',
    color: 'text-amber-400',
    borderColor: 'border-amber-900/40',
    content: (
      <>
        <p className="mb-3">Le conseil se déroule en deux temps :</p>
        <div className="space-y-3 text-sm">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-amber-400 font-semibold mb-1">Débat</p>
            <ul className="text-gray-300 space-y-1">
              <li>- <strong>&gt;10 joueurs vivants :</strong> ordre de parole aléatoire avec chronomètre individuel</li>
              <li>- <strong>≤10 joueurs vivants :</strong> débat libre de 10 minutes</li>
            </ul>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-amber-400 font-semibold mb-1">Vote</p>
            <ul className="text-gray-300 space-y-1">
              <li>- Chaque joueur vivant vote pour éliminer un suspect</li>
              <li>- Le joueur avec le plus de votes est éliminé</li>
              <li>- En cas d'égalité, le maire tranche (sinon tirage au sort)</li>
              <li>- Le rôle de l'éliminé est révélé publiquement</li>
            </ul>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'fantomes',
    title: 'Fantômes',
    color: 'text-green-400',
    borderColor: 'border-green-900/40',
    content: (
      <>
        <p className="mb-3">
          Quand un joueur est éliminé, son rôle est révélé et il devient un <strong className="text-green-400">Fantôme</strong>.
        </p>
        <div className="space-y-3 text-sm">
          <div className="bg-green-900/10 border border-green-900/30 rounded-lg p-3">
            <p className="text-green-400 font-semibold mb-1">Vote d'élimination</p>
            <p className="text-gray-300">
              Chaque nuit, chaque fantôme vote individuellement (sans se concerter) pour
              éliminer un joueur vivant. Majorité gagne, égalité = tirage au sort.
            </p>
          </div>
          <div className="bg-green-900/10 border border-green-900/30 rounded-lg p-3">
            <p className="text-green-400 font-semibold mb-1">Identification (fantômes villageois)</p>
            <p className="text-gray-300">
              Les fantômes qui étaient villageois peuvent sélectionner des joueurs qu'ils
              soupçonnent d'être des loups. +1 point par loup identifié, -1 par erreur.
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'scoring',
    title: 'Scoring',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-900/40',
    content: (
      <>
        <p className="mb-3 text-sm text-gray-400">
          Les scores sont calculés automatiquement mais restent cachés jusqu'à la fin de la partie.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 py-2 pr-3">Condition</th>
                <th className="text-right text-gray-400 py-2">Points</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3">Villageois devine un villageois la nuit</td>
                <td className="text-right text-green-400 font-semibold">+1</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3">Équipe gagne une épreuve</td>
                <td className="text-right text-green-400 font-semibold">+1</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3">Survivant final</td>
                <td className="text-right text-green-400 font-semibold">+3</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3">Villageois vote contre un loup au conseil</td>
                <td className="text-right text-green-400 font-semibold">+2</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3">Loup survit à un conseil du village</td>
                <td className="text-right text-green-400 font-semibold">+1</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3">Fantôme villageois identifie un loup</td>
                <td className="text-right text-green-400 font-semibold">+1</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3">Fantôme villageois se trompe</td>
                <td className="text-right text-red-400 font-semibold">-1</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3">Fantôme loup : villageois éliminé pour lequel il a voté</td>
                <td className="text-right text-green-400 font-semibold">+3</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 pr-3">Chasseur tue un loup</td>
                <td className="text-right text-green-400 font-semibold">+2</td>
              </tr>
              <tr>
                <td className="py-2 pr-3">Chasseur tue un villageois</td>
                <td className="text-right text-red-400 font-semibold">-1</td>
              </tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
];

function Section({ section, isOpen, onToggle }) {
  return (
    <div className={`border ${section.borderColor} rounded-xl overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-900/50 hover:bg-gray-800/50 transition-colors"
      >
        <h3 className={`text-lg font-semibold ${section.color}`}>{section.title}</h3>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-5 py-4 text-gray-300 text-sm leading-relaxed">
          {section.content}
        </div>
      )}
    </div>
  );
}

export default function RulesPage() {
  const [openSections, setOpenSections] = useState(new Set(['principe']));

  function toggleSection(id) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openAll() {
    setOpenSections(new Set(sections.map((s) => s.id)));
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-20">
      {/* Header */}
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/play"
            className="text-gray-500 hover:text-gray-300 transition-colors text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour
          </Link>
          <button
            onClick={openAll}
            className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
          >
            Tout ouvrir
          </button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Règles du jeu</h1>
          <p className="text-gray-500">Les Immortels — Loup-Garou</p>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {sections.map((section) => (
            <Section
              key={section.id}
              section={section}
              isOpen={openSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link
            to="/play"
            className="inline-block px-6 py-3 bg-villager text-white font-semibold rounded-lg hover:bg-blue-800 transition-colors"
          >
            Retour au jeu
          </Link>
        </div>
      </div>
    </div>
  );
}

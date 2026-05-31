# Guide Crossfade & Transition Settings

## Accéder aux paramètres de transition

1. **Ouvrir le lecteur** - Cliquez sur une chanson pour ouvrir le lecteur
2. **Menu Options** - Cliquez sur le bouton menu (⋮) dans le coin supérieur droit du lecteur
3. **Paramètres de transition** - Vous verrez les options de fondu enchaîné et de type de transition

## Utiliser les variantes de transition

### 1. **Linear** (Linéaire)
- Transition classique et simple
- Volume diminue/augmente uniformément
- Le plus prévisible

### 2. **Hard Cut** (Passage instantané)
- Pas de transition du tout
- La chanson suivante démarre immédiatement
- Parfait pour les mix en direct

### 3. **Exponential** (Exponentiel)
- Courbe exponentielle naturelle (p^1.5)
- Commence lentement, s'accélère vers la fin
- Son plus fluide et naturel

### 4. **Equal Power** (Puissance sonore égale)
- Utilise la courbe sqrt(p)
- Maintient une puissance sonore constante
- Recommandé pour les transitions musicales professionnelles

### 5. **Soft Fade** (Fade très douce)
- Courbe cubique lisse (ease-in-out)
- S'accélère au milieu, décélère aux extrémités
- Très progressive et agréable à l'oreille

### 6. **Smooth Step** (Accelération/Décélération)
- Fonction smoothstep classique
- Bonne courbe pour une sensation naturelle
- Équilibre entre progressif et énergique

## Configurer la durée du fondu

1. **Cocher "Fondu enchaîné"** pour activer
2. **Slider de durée** - Réglez entre 1 et 12 secondes
3. **Durée affichée** - Voir le temps en direct

## Sauvegarde automatique

✅ **Tous les paramètres sont sauvegardés automatiquement** dans le navigateur
- Transition type sélectionné
- Durée du fondu enchaîné
- État activé/désactivé

Quand vous revenez sur l'app, vos préférences sont restaurées!

## Conseils

- **Pour la musique classique/jazz**: Essayez "Equal Power" ou "Exponential"
- **Pour l'électronique**: "Hard Cut" ou "Linear" peut mieux convenir
- **Pour une écoute casual**: "Soft Fade" ou "Smooth Step"
- **Expérimentez!** Chaque style musical peut avoir sa préférence

## Dépannage

**Les paramètres ne se sauvegardent pas?**
- Vérifiez que le localStorage n'est pas désactivé dans votre navigateur
- Essayez d'actualiser la page

**Le son se coupe entre les chansons?**
- Vérifiez que le fondu enchaîné est activé
- Vérifiez la durée du fondu (trop courte peut paraître brusque)

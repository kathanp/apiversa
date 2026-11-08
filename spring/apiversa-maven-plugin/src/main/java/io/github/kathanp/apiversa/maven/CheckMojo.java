package io.github.kathanp.apiversa.maven;

import java.io.File;
import java.util.List;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.LifecyclePhase;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Validates {@code api-versions/}. A bad bundle fails the build. */
@Mojo(name = "check", defaultPhase = LifecyclePhase.VERIFY, requiresProject = true)
public class CheckMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/src/main/resources/api-versions")
    private File dir;

    @Parameter(property = "apiversa.today")
    private String today;

    /** {@code -Dsuggest=true} writes a draft change file. Startup still refuses that draft. */
    @Parameter(property = "apiversa.suggest", defaultValue = "false")
    private boolean suggest;

    @Override
    public void execute() throws MojoFailureException {
        try {
            PluginGoals.load(dir.toPath(), today);
            List<String> diffs = PluginGoals.headDiff(dir.toPath());
            if (suggest) {
                String written = PluginGoals.suggest(dir.toPath());
                if (written != null) getLog().warn("wrote draft " + written);
            }
            if (!diffs.isEmpty()) throw new MojoFailureException(String.join("\n", diffs));
            getLog().info("apiversa check passed");
        } catch (MojoFailureException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}

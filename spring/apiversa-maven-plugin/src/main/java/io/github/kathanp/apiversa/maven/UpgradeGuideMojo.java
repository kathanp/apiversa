package io.github.kathanp.apiversa.maven;

import java.io.File;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Lists changes newer than a client date, grouped by endpoint. */
@Mojo(name = "upgrade-guide", requiresProject = true)
public class UpgradeGuideMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/src/main/resources/api-versions")
    private File dir;

    @Parameter(property = "apiversa.from", required = true)
    private String from;

    @Override
    public void execute() throws MojoFailureException {
        try {
            if (from == null || from.isBlank()) throw new MojoFailureException("apiversa.from is required");
            getLog().info(UpgradeGuide.guide(dir.toPath(), from));
        } catch (MojoFailureException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
